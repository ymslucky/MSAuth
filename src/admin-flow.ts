import {
	randomToken,
	redirect,
	getCookie,
	setCookieValue,
} from './http';
import {
	SESSION_COOKIE,
	SESSION_TTL_SECONDS,
} from './constants';
import { authenticate, createAdminSession, deleteAdminSession } from './sessions';
import { hasAnyPermission } from './authz';
import { exchangeGithubCode, getGithubEmail } from './github';
import { readSecret } from './secrets';
import { renderAdminHtml } from './admin';
import { renderMePage } from './me';
import { getOrCreateUser } from './users';

/** One-time login state KV key prefix (10 minute TTL). */
const LOGIN_STATE_PREFIX = 'login:';
const GITHUB_STATE_PREFIX = 'msa_';

/** Public console page (admins only; others see an access-denied screen). */
export async function handleAdminPage(
	request: Request,
	env: Env,
): Promise<Response> {
	const session = await authenticate(env.AUTH_DB, request);
	if (!session) {
		return redirect(new URL("/login", new URL(request.url).origin));
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

export function handleAdminLoginRedirect(request: Request): Response {
	return redirect(new URL("/login", new URL(request.url).origin));
}

/**
 * Unified login landing page: hand-drawn card with a GitHub button and a
 * way back to the homepage. Already-signed-in users are routed by role.
 */
export async function handleLoginPage(
	request: Request,
	env: Env,
): Promise<Response> {
	const origin = new URL(request.url).origin;
	const flowError = new URL(request.url).searchParams.get("error");
	const errorNotice = flowError
		? '<div class="error">登录失败，请重试</div>'
		: "";
	const session = await authenticate(env.AUTH_DB, request);
	if (session) {
		const destination = (await hasAnyPermission(env.AUTH_DB, session.userId))
			? "/admin"
			: "/me";
		return redirect(new URL(destination, origin));
	}
	const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>登录 · MSAuth</title>
<style>
  :root {
    --paper: #fbf7ee; --card: #fffdf6; --ink: #33302a; --ink-soft: #7a7062;
    --line: #d9d2c0; --primary: #2f5ac9; --primary-dark: #2447a3; --highlight: #ffe98a;
    --radius-sketch: 255px 15px 225px 15px / 15px 225px 15px 255px;
    --shadow-sketch: 4px 5px 0 rgba(51, 48, 42, 0.22);
    --font-hand: "Segoe Print", "Comic Sans MS", "Kaiti SC", "楷体", "STKaiti", cursive;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: var(--font-hand); color: var(--ink);
    background:
      repeating-linear-gradient(transparent 0 30px, rgba(47, 90, 201, 0.05) 30px 31px),
      var(--paper);
    min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px;
  }
  .card {
    background: var(--card); border: 2px solid var(--ink);
    border-radius: var(--radius-sketch); box-shadow: var(--shadow-sketch);
    padding: 42px 44px; max-width: 420px; width: 100%; text-align: center;
    transform: rotate(-0.5deg); position: relative;
  }
  .tape {
    position: absolute; top: -12px; left: 50%; transform: translateX(-50%) rotate(2deg);
    width: 110px; height: 26px; background: rgba(255, 233, 138, 0.75);
    border-left: 1px dashed rgba(51,48,42,0.25); border-right: 1px dashed rgba(51,48,42,0.25);
  }
  h1 { font-size: 26px; margin-bottom: 6px; transform: rotate(-0.5deg); }
  .sub { color: var(--ink-soft); font-size: 14px; margin-bottom: 26px; }
  .error { margin-top: 14px; font-size: 13px; color: #c94436; background: #fdecea; border: 1.5px solid #c94436; border-radius: 8px 3px 10px 4px / 4px 10px 3px 8px; padding: 8px 12px; }
  a.gh {
    display: flex; align-items: center; justify-content: center; gap: 12px;
    padding: 13px 16px; text-decoration: none; font-size: 16px; font-family: var(--font-hand);
    color: #fff; background: var(--ink); border: 2px solid var(--ink);
    border-radius: 12px 4px 14px 5px / 5px 14px 4px 12px; box-shadow: 4px 4px 0 rgba(51,48,42,0.3);
  }
  a.gh:hover { transform: translate(-1px, -1px) rotate(-0.6deg); box-shadow: 5px 6px 0 rgba(51,48,42,0.3); }
  a.gh svg { width: 22px; height: 22px; fill: #fff; }
  .hint { margin-top: 16px; font-size: 12px; color: var(--ink-soft); }
  a.home { display: inline-block; margin-top: 22px; font-size: 13px; color: var(--ink-soft); }
  a.home:hover { color: var(--ink); text-decoration: underline wavy; }
</style>
</head>
<body>
<main class="card">
  <div class="tape"></div>
  <h1>登录 MSAuth</h1>
  <p class="sub">使用 GitHub 账号继续</p>
  ${errorNotice}
  <a class="gh" href="/login/start">
    <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>
    使用 GitHub 登录
  </a>
  <p class="hint">登录即表示同意以 GitHub 账号身份访问本服务</p>
  <a class="home" href="/">← 返回主页</a>
</main>
</body>
</html>`;
	return new Response(html, {
		headers: {
			"content-type": "text/html; charset=utf-8",
			"cache-control": "no-store",
			"x-frame-options": "DENY",
			"x-content-type-options": "nosniff",
			"referrer-policy": "no-referrer",
			"content-security-policy":
				"default-src 'none'; style-src 'unsafe-inline'; img-src 'self' https://github.com; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
		},
	});
}

/**
 * GitHub-only login entry: persists a one-time state in KV and redirects
 * straight to GitHub. No PKCE (GitHub does not support it) - CSRF is
 * covered by the one-time state.
 */
export async function handleLoginStart(request: Request, env: Env): Promise<Response> {
	const origin = new URL(request.url).origin;
	const state = GITHUB_STATE_PREFIX + randomToken();
	// One-time login state persisted for the callback (10 minute TTL).
	await env.AUTH_STORAGE.put(LOGIN_STATE_PREFIX + state, '1', {
		expirationTtl: 600,
	});
	const clientId = await readSecret(env.GITHUB_CLIENT_ID);
	return redirect(
		'https://github.com/login/oauth/authorize?' +
			new URLSearchParams({
				client_id: clientId,
				redirect_uri: origin + '/github/callback',
				response_type: 'code',
				state,
				scope: 'user:email',
			}),
	);
}
export async function handleAdminGithubCallback(
	request: Request,
	env: Env,
): Promise<Response> {
	const url = new URL(request.url);
	const origin = url.origin;
	const fail = (reason: string) =>
		redirect(new URL("/login?error=" + reason, origin), []);

	if (url.searchParams.get("error")) return fail("github_error");
	const code = url.searchParams.get("code");
	const state = url.searchParams.get("state") ?? "";
	if (!code || !state.startsWith(GITHUB_STATE_PREFIX)) return fail("invalid_state");

	// One-time consumption of the login state (anti-replay).
	const stateKey = LOGIN_STATE_PREFIX + state;
	if ((await env.AUTH_STORAGE.get(stateKey)) !== "1") return fail("invalid_state");
	await env.AUTH_STORAGE.delete(stateKey);

	try {
		const accessToken = await exchangeGithubCode(
			env,
			code,
			origin + "/github/callback",
		);
		const email = await getGithubEmail(accessToken);
		const userId = await getOrCreateUser(env, email);
		const sessionId = await createAdminSession(
			env.AUTH_DB,
			userId,
			SESSION_TTL_SECONDS,
		);
		console.log("[auth] admin login ok for", email);
		const destination = (await hasAnyPermission(env.AUTH_DB, userId))
			? "/admin"
			: "/me";
		return redirect(new URL(destination, origin), [
			setCookieValue(SESSION_COOKIE, sessionId, SESSION_TTL_SECONDS),
		]);
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		console.error("[auth] admin login failed:", message);
		if (message.includes("registration_disabled")) return fail("registration_disabled");
		return fail("github_exchange");
	}
}
export function handleAdminLogout(request: Request, env: Env): Response {
	const sessionId = getCookie(request, SESSION_COOKIE);
	if (sessionId) {
		env.AUTH_DB.prepare('DELETE FROM admin_sessions WHERE id = ?1').bind(sessionId).run();
	}
	return redirect(new URL('/login', new URL(request.url).origin), [
		setCookieValue(SESSION_COOKIE, '', 0),
	]);
}

/** Public account page for regular (non-admin) users. */
export async function handleMePage(
	request: Request,
	env: Env,
): Promise<Response> {
	const session = await authenticate(env.AUTH_DB, request);
	if (!session) {
		return redirect(new URL("/login", new URL(request.url).origin));
	}
	const user = await env.AUTH_DB
		.prepare("SELECT email FROM user WHERE id = ?1")
		.bind(session.userId)
		.first<{ email: string }>();
	const roles = await env.AUTH_DB
		.prepare(
			`SELECT r.name FROM role r JOIN user_role ur ON ur.role_id = r.id
			WHERE ur.user_id = ?1 ORDER BY r.name`,
		)
		.bind(session.userId)
		.all<{ name: string }>();
	return new Response(
		renderMePage({
			email: user?.email ?? "",
			roles: roles.results.map((r) => r.name),
		}),
		{
			headers: {
				"content-type": "text/html; charset=utf-8",
				"cache-control": "no-store",
				"x-frame-options": "DENY",
				"x-content-type-options": "nosniff",
				"referrer-policy": "no-referrer",
				"content-security-policy":
					"default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
			},
		},
	);
}
