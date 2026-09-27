import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { admin, bearer, jwt, organization, twoFactor } from "better-auth/plugins";
import { oauthProvider } from "@better-auth/oauth-provider";
import { apiKey } from "@better-auth/api-key";
import { passkey } from "@better-auth/passkey";
import { exchangeExtension, EXCHANGE_GRANT } from "../agent/exchange";
import { secret, type Bindings } from "./types";

export const OAUTH_SCOPES = ["openid", "profile", "email", "offline_access", "mcp:invoke", "agent:delegate"];

export function authPlugins(baseURL: string, env?: Bindings, adminIds: string[] = []) {
  return [
    admin({ adminUserIds: adminIds, defaultRole: "user" }),
    bearer(),
    jwt({
      jwt: { issuer: baseURL, audience: baseURL, expirationTime: "5m" },
      jwks: { keyPairConfig: { alg: "ES256" }, rotationInterval: 30 * 86400, gracePeriod: 7 * 86400 },
    }),
    passkey({ rpID: new URL(baseURL).hostname, rpName: "MSAuth", origin: baseURL }),
    twoFactor({ issuer: "MSAuth", allowPasswordless: true }),
    organization({ allowUserToCreateOrganization: true, organizationLimit: 3, membershipLimit: 10 }),
    apiKey({
      defaultPrefix: "msa_", enableSessionForAPIKeys: false, enableMetadata: true,
      permissions: { defaultPermissions: { profile: ["read"] } },
      keyExpiration: { defaultExpiresIn: 30 * 86400000, maxExpiresIn: 90 },
      rateLimit: { enabled: true, timeWindow: 60000, maxRequests: 60 },
    }),
    oauthProvider({
      loginPage: "/login", consentPage: "/consent",
      scopes: OAUTH_SCOPES,
      grantTypes: ["authorization_code", "refresh_token", "client_credentials", EXCHANGE_GRANT],
      accessTokenExpiresIn: 300, m2mAccessTokenExpiresIn: 300, refreshTokenExpiresIn: 7 * 86400,
      codeExpiresIn: 60,
      allowDynamicClientRegistration: true,
      allowUnauthenticatedClientRegistration: true,
      clientRegistrationDefaultScopes: ["openid"],
      clientRegistrationAllowedScopes: OAUTH_SCOPES,
      enforcePerClientResources: true,
      dpop: { signingAlgorithms: ["ES256"], proofMaxAgeSeconds: 60 },
      extensions: env ? [exchangeExtension(env)] : [],
      resourcePrivileges: ({ user }) => !!user && adminIds.includes(user.id),
      prefix: { clientSecret: "msa_cs_", refreshToken: "msa_rt_", opaqueAccessToken: "msa_at_" },
    }),
  ];
}

/**
 * Instances are keyed by every input they were built from (base URL, resolved
 * secrets, admin allowlist membership), so a secret rotation, an allowlist
 * change or an emailVerified flip produces a new key and a fresh instance —
 * the per-request freshness guarantees hold; only the factory rebuild is
 * amortized across requests with identical inputs.
 */
const instanceCache = new Map<string, Awaited<ReturnType<typeof buildAuth>>>();

async function instanceKey(parts: unknown[]): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(parts)));
	return btoa(String.fromCharCode(...new Uint8Array(digest)));
}

export async function createAuth(env: Bindings) {
	const baseURL = new URL(env.BETTER_AUTH_URL).origin;
	const [authSecret, clientId, clientSecret, adminEmails] = await Promise.all([
		secret(env.BETTER_AUTH_SECRET), secret(env.GITHUB_CLIENT_ID),
		secret(env.GITHUB_CLIENT_SECRET), secret(env.ADMIN_EMAIL),
	]);
	if (authSecret.length < 32) throw new Error("BETTER_AUTH_SECRET must contain at least 32 characters");
	// The kill switch is a test-only escape hatch: reserved test/local origins
	// may honor it, so a stray RATE_LIMIT_DISABLED var can never silence the
	// limiter in production.
	const hostname = new URL(baseURL).hostname;
	const honorKillSwitch = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || hostname.endsWith(".test");
	const rateLimitDisabled = env.RATE_LIMIT_DISABLED === "1" && honorKillSwitch;
	const allowlist = adminEmails.split(",").map(value => value.trim().toLowerCase()).filter(Boolean);
	// Filter by the allowlist itself — a full scan of every verified user per
	// request is wasted work once the allowlist is a handful of emails.
	let adminIds: string[] = [];
	if (allowlist.length) {
		const placeholders = allowlist.map(() => "?").join(",");
		const admins = await env.AUTH_DB.prepare(`SELECT id FROM "user" WHERE emailVerified = 1 AND lower(email) IN (${placeholders})`)
			.bind(...allowlist).all<{ id: string }>();
		adminIds = admins.results.map(user => user.id);
	}
	const cacheKey = await instanceKey([baseURL, authSecret, clientId, clientSecret, adminEmails, rateLimitDisabled, adminIds]);
	const cached = instanceCache.get(cacheKey);
	if (cached) return cached;
	const instance = buildAuth(env, baseURL, authSecret, clientId, clientSecret, allowlist, adminIds, rateLimitDisabled);
	// Small keyed cache — in practice one entry per deployed configuration.
	if (instanceCache.size >= 8) instanceCache.clear();
	instanceCache.set(cacheKey, instance);
	return instance;
}

function buildAuth(env: Bindings, baseURL: string, authSecret: string, clientId: string, clientSecret: string, allowlist: string[], adminIds: string[], rateLimitDisabled: boolean) {
	return betterAuth({
    appName: "MSAuth", baseURL, basePath: "/api/auth", secret: authSecret,
    database: env.AUTH_DB,
    trustedOrigins: [baseURL],
    emailAndPassword: { enabled: true, disableSignUp: true, requireEmailVerification: true, minPasswordLength: 12 },
    socialProviders: clientId && clientSecret ? { github: { clientId, clientSecret } } : {},
    account: { accountLinking: { enabled: false } },
    session: { expiresIn: 7 * 86400, updateAge: 3600, cookieCache: { enabled: false } },
    advanced: {
      // Preserve the provider's deterministic replay-reservation IDs.
      database: { generateId: () => crypto.randomUUID() },
      useSecureCookies: baseURL.startsWith("https:"),
      // Explicit where we would otherwise depend on framework defaults drifting.
      defaultCookieAttributes: { path: "/", sameSite: "lax" },
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
    },
    rateLimit: { enabled: !rateLimitDisabled, storage: "database", window: 60, max: 60 },
    disabledPaths: ["/token"],
    databaseHooks: {
      user: { create: { before: async (user) => {
        const setting = await env.AUTH_DB.prepare("SELECT value FROM platformSetting WHERE key = 'registrationEnabled'").first<{ value: string }>();
        if (setting?.value === "false" && !allowlist.includes(user.email.toLowerCase())) {
          throw new APIError("FORBIDDEN", { message: "Registration is disabled" });
        }
        return { data: user };
      } } },
    },
    plugins: authPlugins(baseURL, env, adminIds),
  });
}
