import { createIssuer } from "./issuer";
import {
	handleAdminGithubCallback,
	handleAdminLoginRedirect,
	handleAdminPage,
	handleLoginPage,
	handleLoginStart,
	handleAdminLogout,
	handleMePage,
} from "./admin-flow";
import apiApp from "./api/router";
import { json, redirect } from "./http";
import { renderHomePage } from "./home";
import { faviconResponse } from "./favicon";
import { renderNotFoundPage, renderErrorPage } from "./ui/pages";

/**
 * Worker entry point. Request routing only — authentication flows live in
 * ./admin-flow, the OpenAuth server in ./issuer and the management API in
 * ./api/router.
 */
export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext) {
		try {
			return await handleRequest(request, env, ctx);
		} catch (e) {
			// Surface the real failure in logs instead of an opaque platform 5xx.
			console.error(
				"[worker] unhandled error:",
				e instanceof Error ? e.stack : e,
			);
			const accept = request.headers.get("accept") ?? "";
			if (accept.includes("text/html")) {
				return new Response(renderErrorPage(), {
					status: 500,
					headers: {
						"content-type": "text/html; charset=utf-8",
						"cache-control": "no-store",
						"x-frame-options": "DENY",
						"x-content-type-options": "nosniff",
						"content-security-policy":
							"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
					},
				});
			}
			return json({ error: "internal_error" }, 500);
		}
	},
} satisfies ExportedHandler<Env>;

async function handleRequest(
	request: Request,
	env: Env,
	ctx: ExecutionContext,
): Promise<Response> {
	const url = new URL(request.url);

	// Known top-level paths; anything else is a friendly 404 page instead of
	// OpenAuth's bare text response.
	const ISSUER_PREFIXES = [
		"/authorize", "/token", "/github", "/password", "/.well-known",
		"/login", "/login/github", "/login/start", "/me", "/admin", "/api", "/favicon.ico", "/",
	];
	const isKnownPath = ISSUER_PREFIXES.some(
		(p) => url.pathname === p || url.pathname.startsWith(p + "/")
	);

	// Abuse protection: cap GitHub authorization-endpoint hits per IP. The
	// binding is configured for 60 requests per 60 second window.
	if (url.pathname.startsWith("/github/")) {
		const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
		const outcome = await env.RATE_LIMITER.limit({ key: ip });
		if (!outcome.success) {
			return json({ error: "rate_limited" }, 429);
		}
	}

	// The OpenAuth server (also serves /authorize, /token, jwks...).
	const app = await createIssuer(env);

	// Public homepage: static, no scripts, no parameter reflection.
	if (url.pathname === "/") {
		return new Response(renderHomePage(), {
			headers: {
				"content-type": "text/html; charset=utf-8",
				"cache-control": "no-store",
				"x-frame-options": "DENY",
				"x-content-type-options": "nosniff",
				"referrer-policy": "no-referrer",
				"content-security-policy":
					"default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
			},
		});
	} else if (url.pathname === "/favicon.ico") {
		return faviconResponse();
	} else if (url.pathname === "/login") {
		// Unified login entry for every role.
		return await handleLoginPage(request, env);
	} else if (url.pathname === "/login/start") {
		return await handleLoginStart(request, env);
	} else if (url.pathname === "/me") {
		return handleMePage(request, env);
	} else if (url.pathname === "/admin/login") {
		// Legacy alias: everything funnels through /login now.
		return handleAdminLoginRedirect(request);
	} else if (url.pathname === "/admin") {
		return handleAdminPage(request, env);
	} else if (url.pathname === "/github/callback") {
		// Management sign-in callbacks carry our msa_ state prefix; downstream
		// OAuth client callbacks fall through to the issuer.
		if ((url.searchParams.get("state") ?? "").startsWith("msa_")) {
			return await handleAdminGithubCallback(request, env);
		}
		return app.fetch(request, env, ctx);
	} else if (url.pathname === "/admin/logout") {
		return handleAdminLogout(request, env);
	} else if (url.pathname.startsWith("/api/")) {
		return apiApp.fetch(request, env, ctx);
	}

	if (isKnownPath) {
		return app.fetch(request, env, ctx);
	}
	return new Response(renderNotFoundPage(), {
		status: 404,
		headers: {
			"content-type": "text/html; charset=utf-8",
			"cache-control": "no-store",
			"x-frame-options": "DENY",
			"x-content-type-options": "nosniff",
			"content-security-policy":
				"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
		},
	});
}