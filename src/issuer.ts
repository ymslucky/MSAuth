import { issuer } from "@openauthjs/openauth";
import { GithubProvider } from "@openauthjs/openauth/provider/github";
import { ADMIN_CLIENT_ID } from "./constants";
import { getGithubEmail } from "./github";
import { getAdminAllowlist, resolveGitHubCredentials } from "./secrets";
import { createStorage } from "./storage";
import { subjects } from "./subjects";
import { getOrCreateUser, getUserRoleNames } from "./users";

/**
 * Builds the OpenAuth issuer (the actual authentication server). A new
 * instance is created per request, which keeps the factory signature simple
 * and lets every piece read current bindings.
 */
type IssuerApp = Awaited<ReturnType<typeof buildIssuer>>;

// Building the issuer resolves Secrets Store bindings and rebuilds the Hono
// app; cache it briefly so per-request latency stays flat. Secrets rotations
// take effect within a minute.
let issuerCache: { app: Promise<IssuerApp>; expires: number } | null = null;
const ISSUER_CACHE_TTL_MS = 60_000;

export async function createIssuer(env: Env): Promise<IssuerApp> {
	if (issuerCache && Date.now() < issuerCache.expires) {
		return issuerCache.app;
	}
	const app = buildIssuer(env);
	issuerCache = { app, expires: Date.now() + ISSUER_CACHE_TTL_MS };
	return app;
}

async function buildIssuer(env: Env) {
	const [clientID, clientSecret] = await resolveGitHubCredentials(env);

	return issuer({
		storage: createStorage(env),
		subjects,
		// Never leak internal error details to browsers.
		error: async () =>
			new Response("authentication error", {
				status: 400,
				headers: { "content-type": "text/plain" },
			}),
		ttl: {
			access: 60 * 60,
			refresh: 30 * 24 * 60 * 60,
		},
		// Only pre-registered clients may start authorization flows, and only
		// with their exact redirect URI.
		allow: async (input, req) => {
			const origin = new URL(req.url).origin;
			return (
				input.clientID === ADMIN_CLIENT_ID &&
				input.redirectURI === origin + "/admin/callback"
			);
		},
		providers: {
			// GitHub-only sign-in. Password login was removed: without an email
			// provider the verification codes could never be delivered.
			github: GithubProvider({
				clientID,
				clientSecret,
				scopes: ["user:email"],
			}),
		},
		theme: {
			title: "MSAuth",
			primary: "#2f5ac9",
			favicon: "https://workers.cloudflare.com//favicon.ico",
			logo: {
				dark: "https://imagedelivery.net/wSMYJvS3Xw-n339CbDyDIA/db1e5c92-d3a6-4ea9-3e72-155844211f00/public",
				light:
					"https://imagedelivery.net/wSMYJvS3Xw-n339CbDyDIA/fa5a3023-7da9-466b-98a7-4ce01ee6c700/public",
			},
		},
		success: async (ctx, value) => {
			// GitHub is the only provider: resolve the verified email via the
			// GitHub API.
			const email = await getGithubEmail(value.tokenset.access);
			const id = await getOrCreateUser(env, email);
			return ctx.subject("user", {
				id,
				roles: await getUserRoleNames(env.AUTH_DB, id),
			});
		},
	});
}