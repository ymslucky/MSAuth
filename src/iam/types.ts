import type { createAuth } from "./auth";

export interface Bindings {
  AUTH_DB: D1Database;
  AUTH_STORAGE: KVNamespace;
  ASSETS?: Fetcher;
  RATE_LIMITER: RateLimit;
  BETTER_AUTH_URL: string;
  BETTER_AUTH_SECRET: string | SecretsStoreSecret;
  GITHUB_CLIENT_ID: string | SecretsStoreSecret;
  GITHUB_CLIENT_SECRET: string | SecretsStoreSecret;
  ADMIN_EMAIL: string | SecretsStoreSecret;
}

export type Auth = Awaited<ReturnType<typeof createAuth>>;
export type Identity = Auth["$Infer"]["Session"];
export type AppEnv = {
  Bindings: Bindings;
  Variables: { auth: Auth; identity: Identity; operator: boolean; requestId: string };
};

export async function secret(value: string | SecretsStoreSecret): Promise<string> {
  return typeof value === "string" ? value : value.get();
}

export async function isOperator(env: Bindings, email: string, verified: boolean): Promise<boolean> {
  if (!verified) return false;
  const allowlist = (await secret(env.ADMIN_EMAIL)).split(",").map(s => s.trim().toLowerCase());
  return allowlist.includes(email.toLowerCase());
}
