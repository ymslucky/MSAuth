import { randomToken, base64UrlEncode, redirect, getCookie, setCookieValue } from "./http";
import { ADMIN_CLIENT_ID, OAUTH_STATE_COOKIE, SESSION_COOKIE, SESSION_TTL_SECONDS } from "./constants";
import { authenticate, createAdminSession, deleteAdminSession } from "./sessions";
import { verifyAccessToken, type AccessTokenPayload } from "./tokens";
import { renderAdminHtml } from "./admin";
import type { createIssuer } from "./issuer";

export async function handleAdminPage(request: Request, env: Env): Promise<Response> {
	const session = await authenticate(env.AUTH_DB, request);
	if (!session) {
		return redirect(new URL("/admin/login", new URL(request.url).origin));
	}
	const nonce = randomToken();
	return new Response(renderAdminHtml(nonce), {
		headers: {
			"content-type": "text/html; charset=utf-8",
			"cache-control": "no-store",
			"x-frame-options": "DENY",
			"x-content-type-options": "nosniff",
			"content-security-policy":
				"default-src 'none'; script-src 'nonce-" +
				nonce +
				"'; style-src 'unsafe-inline'; img-src https:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
		},
	});
}

export async function handleAdminLogin(request: Request): Promise<Response> {
	const origin = new URL(request.url).origin;
	const state = randomToken();
	const verifier = randomToken();
	const challenge = base64UrlEncode(
		new Uint8Array(
			await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
		),
	);
	return redirect(
		`${origin}/authorize?${new URLSearchParams({
			client_id: ADMIN_CLIENT_ID,
			redirect_uri: `${origin}/admin/callback`,
			response_type: "code",
			state,
			scope: "openid",
			code_challenge: challenge,
			code_challenge_method: "S256",
		})}`,
		[
			setCookieValue(
				OAUTH_STATE_COOKIE,
				btoa(JSON.stringify({ state, verifier })),
				600,
			),
		],
	);
}

export async function handleAdminCallback(
	request: Request,
	env: Env,
	ctx: ExecutionContext,
	app: Awaited<ReturnType<typeof createIssuer>>,
): Promise<Response> {
	const url = new URL(request.url);
	const code = url.searchParams.get("code");
	const state = url.searchParams.get("state");
	const oauthError = url.searchParams.get("error");
	let stored: { state?: string; verifier?: string } = {};
	try {
		stored = JSON.parse(atob(getCookie(request, OAUTH_STATE_COOKIE) ?? ""));
	} catch {}

	const fail = (reason: string) => {
		const loginUrl = new URL("/admin/login", url.origin);
		loginUrl.searchParams.set("error", reason);
		return redirect(loginUrl, [setCookieValue(OAUTH_STATE_COOKIE, "", 0)]);
	};
	if (
		oauthError ||
		!code ||
		!state ||
		!stored.state ||
		!stored.verifier ||
		state !== stored.state
	) {
		return fail(oauthError ?? "invalid_state");
	}

	// Exchange the authorization code in-process against our own /token route.
	const tokenResponse = await app.fetch(
		new Request(new URL("/token", url.origin), {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				grant_type: "authorization_code",
				code,
				redirect_uri: new URL("/admin/callback", url.origin).toString(),
				client_id: ADMIN_CLIENT_ID,
				code_verifier: stored.verifier,
			}),
		}),
		env,
		ctx,
	);
	const tokens = (await tokenResponse.json()) as {
		access_token?: string;
		expires_in?: number;
	};
	if (!tokenResponse.ok || !tokens.access_token) {
		return fail("token_exchange_failed");
	}
	let payload: AccessTokenPayload;
	try {
		payload = await verifyAccessToken(env, tokens.access_token);
	} catch {
		return fail("invalid_token");
	}

	// The access token is only used to identify the user; the browser gets an
	// opaque server-side session id that can be revoked independently.
	const sessionId = await createAdminSession(
		env.AUTH_DB,
		payload.properties.id,
		SESSION_TTL_SECONDS,
	);
	return redirect(new URL("/admin", url.origin), [
		setCookieValue(OAUTH_STATE_COOKIE, "", 0),
		setCookieValue(SESSION_COOKIE, sessionId, SESSION_TTL_SECONDS),
	]);
}

export function handleAdminLogout(request: Request, env: Env): Response {
	const sessionId = getCookie(request, SESSION_COOKIE);
	if (sessionId) {
		env.AUTH_DB.prepare("DELETE FROM admin_sessions WHERE id = ?1").bind(sessionId).run();
	}
	return redirect(new URL("/admin/login", new URL(request.url).origin), [
		setCookieValue(SESSION_COOKIE, "", 0),
	]);
}