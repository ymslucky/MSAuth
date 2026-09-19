import { createIssuer } from "./issuer";
import {
	handleAdminCallback,
	handleAdminLogin,
	handleAdminLogout,
	handleAdminPage,
} from "./admin-flow";
import apiApp from "./api/router";
import { json } from "./http";
import { renderHomePage } from "./home";
import { ensureSchema } from "./db/ensure-schema";

/**
 * Worker entry point. Request routing only — authentication flows live in
 * ./admin-flow, the OpenAuth server in ./issuer and the management API in
 * ./api/router.
 */
export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext) {
		// Self-healing schema: every cold start reconciles the database with
		// the desired state in ./db/schema.sql (cached per isolate).
		await ensureSchema(env.AUTH_DB);

		const url = new URL(request.url);

		// Brute-force protection: cap password endpoint POSTs per IP. The
		// binding is configured for 60 requests per 60 second window.
		if (url.pathname.startsWith("/password/") && request.method === "POST") {
			const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
			const outcome = await env.RATE_LIMITER.limit({ key: ip });
			if (!outcome.success) {
				return json({ error: "rate_limited" }, 429);
			}
		}

		// The OpenAuth server (also serves /authorize, /token, providers...).
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
		} else if (url.pathname === "/admin") {
			return handleAdminPage(request, env);
		} else if (url.pathname === "/admin/login") {
			return await handleAdminLogin(request);
		} else if (url.pathname === "/admin/callback") {
			return handleAdminCallback(request, env, ctx, app);
		} else if (url.pathname === "/admin/logout") {
			return handleAdminLogout(request, env);
		} else if (url.pathname.startsWith("/api/")) {
			return apiApp.fetch(request, env, ctx);
		}

		return app.fetch(request, env, ctx);
	},
} satisfies ExportedHandler<Env>;