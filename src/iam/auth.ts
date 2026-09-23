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

/** Secrets and administrator membership are resolved per request, never cached indefinitely. */
export async function createAuth(env: Bindings) {
  const baseURL = new URL(env.BETTER_AUTH_URL).origin;
  const [authSecret, clientId, clientSecret, adminEmails] = await Promise.all([
    secret(env.BETTER_AUTH_SECRET), secret(env.GITHUB_CLIENT_ID),
    secret(env.GITHUB_CLIENT_SECRET), secret(env.ADMIN_EMAIL),
  ]);
  if (authSecret.length < 32) throw new Error("BETTER_AUTH_SECRET must contain at least 32 characters");
  const allowlist = adminEmails.split(",").map(value => value.trim().toLowerCase()).filter(Boolean);
  const users = await env.AUTH_DB.prepare('SELECT id, email FROM "user" WHERE emailVerified = 1').all<{ id: string; email: string }>();
  const adminIds = users.results.filter(user => allowlist.includes(user.email.toLowerCase())).map(user => user.id);
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
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
    },
    rateLimit: { enabled: true, storage: "database", window: 60, max: 60 },
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
