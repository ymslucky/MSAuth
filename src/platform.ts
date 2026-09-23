import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { bodyLimit } from "hono/body-limit";
import { secureHeaders } from "hono/secure-headers";
import { oauthProviderAuthServerMetadata, oauthProviderOpenIdConfigMetadata } from "@better-auth/oauth-provider";
import { createAuth } from "./iam/auth";
import { isOperator, type AppEnv } from "./iam/types";
import { agentRoutes } from "./iam/agents";
import { developerRoutes } from "./iam/developers";
import { governanceRoutes } from "./iam/governance";

const app = new Hono<AppEnv>();

app.use("*", secureHeaders({
  contentSecurityPolicy: {
    defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", "data:"], connectSrc: ["'self'"], frameAncestors: ["'none'"],
    objectSrc: ["'none'"], baseUri: ["'self'"], formAction: ["'self'"],
  },
  referrerPolicy: "no-referrer",
}));
app.use("*", async (c, next) => {
  c.set("requestId", crypto.randomUUID());
  c.header("x-request-id", c.get("requestId"));
  await next();
});
app.use("/api/*", bodyLimit({ maxSize: 65536, onError: c => c.json({ error: "payload_too_large" }, 413) }));
app.use("/api/*", async (c, next) => {
  c.header("cache-control", "no-store");
  if (c.req.path.startsWith("/api/auth/")) {
    const key = (c.req.header("cf-connecting-ip") ?? "unknown") + ":" + c.req.path;
    if (!(await c.env.RATE_LIMITER.limit({ key })).success) return c.json({ error: "rate_limited" }, 429);
  }
  await next();
});

app.get("/health", c => c.json({ service: "MSAuth", version: "2.0.0" }));
app.get("/.well-known/oauth-authorization-server", async c => {
  const auth = await createAuth(c.env);
  return oauthProviderAuthServerMetadata(auth)(c.req.raw);
});
app.get("/.well-known/openid-configuration", async c => {
  const auth = await createAuth(c.env);
  return oauthProviderOpenIdConfigMetadata(auth)(c.req.raw);
});

app.on(["GET", "POST", "PATCH", "DELETE", "OPTIONS"], "/api/auth/*", async c => {
  if (c.req.path.startsWith("/api/auth/admin/")) return c.json({ error: "not_found" }, 404);
  if (c.req.path === "/api/auth/oauth2/register") {
    const setting = await c.env.AUTH_DB.prepare("SELECT value FROM platformSetting WHERE key = 'dcrEnabled'").first<{ value: string }>();
    if (setting?.value === "false") return c.json({ error: "registration_disabled" }, 403);
  }
  // RAR consent is managed by the explicit delegation UI, never silently ignored on /authorize.
  if (c.req.path.endsWith("/oauth2/authorize") && c.req.query("authorization_details")) {
    return c.json({ error: "invalid_authorization_details", error_description: "Create an explicit MSAuth delegation before token exchange" }, 400);
  }
  const auth = await createAuth(c.env);
  return auth.handler(c.req.raw);
});

app.use("/api/v1/*", async (c, next) => {
  const auth = await createAuth(c.env);
  // Browser management must not inherit API-key or Bearer session impersonation.
  const headers = new Headers(c.req.raw.headers);
  headers.delete("authorization");
  headers.delete("x-api-key");
  const identity = await auth.api.getSession({ headers });
  if (!identity) return c.json({ error: "unauthorized" }, 401);
  if (!["GET", "HEAD", "OPTIONS"].includes(c.req.method) &&
    c.req.header("origin") !== new URL(c.env.BETTER_AUTH_URL).origin) return c.json({ error: "invalid_origin" }, 403);
  c.set("auth", auth);
  c.set("identity", identity);
  c.set("operator", await isOperator(c.env, identity.user.email, identity.user.emailVerified));
  await next();
});
app.route("/api/v1", agentRoutes);
app.route("/api/v1", developerRoutes);
app.route("/api/v1", governanceRoutes);
app.all("/api/*", c => c.json({ error: "not_found" }, 404));
app.get("*", c => c.env.ASSETS ? c.env.ASSETS.fetch(c.req.raw) : c.json({ error: "assets_not_built" }, 503));

app.onError((error, c) => {
  if (error instanceof HTTPException) return c.json({ error: error.message }, error.status);
  if ("statusCode" in error && typeof error.statusCode === "number" && error.statusCode >= 400 && error.statusCode < 500) {
    const detail = ("body" in error ? error.body as { message?: string; error_description?: string; error?: string } : {}) ?? {};
    return c.json({ error: detail.error_description ?? detail.message ?? detail.error ?? error.message ?? "invalid_request" }, error.statusCode as 400);
  }
  console.error(JSON.stringify({ requestId: c.get("requestId"), error: error.message }));
  return c.json({ error: "internal_error", requestId: c.get("requestId") }, 500);
});

export default app;
