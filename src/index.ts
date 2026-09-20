import { createIssuer } from "./issuer";
import {
	handleAdminCallback,
	handleAdminPage,
	handleLoginPage,
	handleLoginStart,
	handleAdminLogout,
	handleMePage,
} from "./admin-flow";
import apiApp from "./api/router";
import { json, redirect } from "./http";
import { renderHomePage } from "./home";

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
			return json({ error: "internal_error" }, 500);
		}
	},

	// Keep-alive: a low-traffic site gets its isolate recycled, and every new
	// isolate pays cold-start costs. Pinging the homepage every 5 minutes
	// keeps the warm isolate resident.
	async scheduled(
		controller: ScheduledController,
		env: Env,
		ctx: ExecutionContext,
	) {
		ctx.waitUntil(fetch("https://auth.msxor.com/").catch(() => {}));
	},
} satisfies ExportedHandler<Env>;

async function handleRequest(
	request: Request,
	env: Env,
	ctx: ExecutionContext,
): Promise<Response> {
	const url = new URL(request.url);

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
					"default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
			},
		});
	} else if (url.pathname === "/login") {
		// Unified login entry for every role.
		return await handleLoginPage(request, env);
	} else if (url.pathname === "/login/start") {
		return await handleLoginStart(request, env, ctx, app);
	} else if (url.pathname === "/me") {
		return handleMePage(request, env);
	} else if (url.pathname === "/admin/login") {
		// Legacy alias: everything funnels through /login now.
		return redirect("/login");
	} else if (url.pathname === "/admin") {
		return handleAdminPage(request, env);
	} else if (url.pathname === "/admin/callback") {
		return handleAdminCallback(request, env, ctx, app);
	} else if (url.pathname === "/admin/logout") {
		return handleAdminLogout(request, env);
	} else if (url.pathname.startsWith("/api/")) {
		return apiApp.fetch(request, env, ctx);
	}

	return app.fetch(request, env, ctx);
}