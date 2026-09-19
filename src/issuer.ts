import { issuer } from "@openauthjs/openauth";
import { PasswordProvider } from "@openauthjs/openauth/provider/password";
import { GithubProvider } from "@openauthjs/openauth/provider/github";
import { PasswordUI } from "@openauthjs/openauth/ui/password";
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
export async function createIssuer(env: Env) {
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
			password: PasswordProvider(
				PasswordUI({
					sendCode: async (email, code) => {
						// This is where you would email the verification code to the
						// user, e.g. using Resend:
						// https://resend.com/docs/send-with-cloudflare-workers
						console.log(`Sending code ${code} to ${email}`);
						// Email delivery is not configured yet; expose the code through
						// storage so integration tests and operators can retrieve it.
						await env.AUTH_STORAGE.put(`debug:code:${email}`, code, {
							expirationTtl: 600,
						});
					},
					copy: {
						input_code: "Code (check Worker logs)",
					},
				}),
			),
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
			// The GitHub provider resolves to { provider, clientID, tokenset },
			// so the email has to be looked up via the GitHub API.
			const email =
				value.provider === "github"
					? await getGithubEmail(value.tokenset.access)
					: value.email;
			const id = await getOrCreateUser(env, email);
			return ctx.subject("user", {
				id,
				roles: await getUserRoleNames(env.AUTH_DB, id),
			});
		},
	});
}