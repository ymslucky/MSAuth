import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "./types";
import { audit, body, list, text, requireOperator } from "./http";
import { validateRedirect, validateResource } from "../agent/policy";
import { EXCHANGE_GRANT } from "../agent/exchange";
import { OAUTH_SCOPES } from "./auth";

export const developerRoutes = new Hono<AppEnv>();

developerRoutes.get("/applications", async c => {
  const items = await c.get("auth").api.getOAuthClients({ headers: c.req.raw.headers });
  return c.json({ items });
});

developerRoutes.post("/applications", async c => {
  const input = await body(c);
  const name = text(input.name, "name");
  let redirects: string[];
  try { redirects = list(input.redirectUris, "redirectUris").map(validateRedirect); }
  catch { throw new HTTPException(400, { message: "Use exact HTTPS or loopback callback URLs" }); }
  if (!redirects.length) throw new HTTPException(400, { message: "At least one callback URL is required" });
  const result = await c.get("auth").api.createOAuthClient({
    headers: c.req.raw.headers,
    body: {
      client_name: name, redirect_uris: redirects,
      application_type: redirects.some(uri => uri.startsWith("http:")) ? "native" : "web",
      token_endpoint_auth_method: input.confidential === true ? "client_secret_basic" : "none",
      grant_types: ["authorization_code", "refresh_token", EXCHANGE_GRANT],
      response_types: ["code"], scope: OAUTH_SCOPES.join(" "),
      dpop_bound_access_tokens: input.dpop === true,
    },
  });
  await audit(c, "application.created", "application", result.client_id, { name });
  return c.json(result, 201);
});

developerRoutes.patch("/applications/:id", async c => {
  const input = await body(c);
  let redirects: string[];
  try { redirects = list(input.redirectUris, "redirectUris").map(validateRedirect); }
  catch { throw new HTTPException(400, { message: "Invalid callback URLs" }); }
  if (!redirects.length) throw new HTTPException(400, { message: "At least one callback URL is required" });
  const result = await c.get("auth").api.updateOAuthClient({
    headers: c.req.raw.headers,
    body: { client_id: c.req.param("id"), update: { client_name: text(input.name, "name"), redirect_uris: redirects } },
  });
  await audit(c, "application.updated", "application", c.req.param("id"));
  return c.json(result);
});

developerRoutes.delete("/applications/:id", async c => {
  await c.get("auth").api.deleteOAuthClient({ headers: c.req.raw.headers, body: { client_id: c.req.param("id") } });
  await audit(c, "application.deleted", "application", c.req.param("id"));
  return c.json({ ok: true });
});

developerRoutes.post("/applications/:id/rotate", async c => {
  const result = await c.get("auth").api.rotateClientSecret({ headers: c.req.raw.headers, body: { client_id: c.req.param("id") } });
  await audit(c, "application.secret_rotated", "application", c.req.param("id"));
  return c.json(result);
});

developerRoutes.get("/keys", async c => {
  const result = await c.get("auth").api.listApiKeys({ headers: c.req.raw.headers, query: {} });
  return c.json(result);
});

developerRoutes.post("/keys", async c => {
  const input = await body(c);
  const result = await c.get("auth").api.createApiKey({
    headers: c.req.raw.headers,
    body: { name: text(input.name, "name"), expiresIn: 30 * 86400 },
  });
  await audit(c, "key.created", "key", result.id);
  return c.json(result, 201);
});

developerRoutes.delete("/keys/:id", async c => {
  await c.get("auth").api.deleteApiKey({ headers: c.req.raw.headers, body: { keyId: c.req.param("id") } });
  await audit(c, "key.revoked", "key", c.req.param("id"));
  return c.json({ ok: true });
});

developerRoutes.get("/resources", async c => {
  const result = await c.env.AUTH_DB.prepare("SELECT id, identifier, name, accessTokenTtl, allowedScopes, dpopBoundAccessTokensRequired, disabled FROM oauthResource ORDER BY name").all();
  return c.json({ items: result.results });
});

developerRoutes.post("/resources", async c => {
  requireOperator(c);
  const input = await body(c);
  let identifier: string;
  try { identifier = validateResource(text(input.identifier, "identifier", 2048)); }
  catch { throw new HTTPException(400, { message: "An exact HTTPS resource identifier is required" }); }
  const resource = await c.get("auth").api.adminCreateOAuthResource({
    headers: c.req.raw.headers,
    body: { identifier, name: text(input.name, "name"), accessTokenTtl: 300, allowedScopes: ["mcp:invoke", "agent:delegate"], dpopBoundAccessTokensRequired: true },
  });
  await audit(c, "resource.created", "resource", resource.id, { identifier });
  return c.json(resource, 201);
});

developerRoutes.post("/resources/link", async c => {
  requireOperator(c);
  const input = await body(c);
  const identifier = text(input.identifier, "identifier", 2048);
  const clientId = text(input.clientId, "clientId", 256);
  const result = await c.get("auth").api.adminLinkClientResource({
    headers: c.req.raw.headers, params: { identifier, client_id: clientId },
  });
  await audit(c, "resource.linked", "application", clientId, { identifier });
  return c.json(result);
});

developerRoutes.get("/registrations", async c => {
  requireOperator(c);
  const items = await c.env.AUTH_DB.prepare("SELECT clientId, name, createdAt, redirectUris, scopes, disabled, dpopBoundAccessTokens FROM oauthClient WHERE userId IS NULL ORDER BY createdAt DESC LIMIT 200").all();
  return c.json({ items: items.results });
});

developerRoutes.delete("/registrations/:id", async c => {
  requireOperator(c);
  const id = c.req.param("id");
  const result = await c.env.AUTH_DB.prepare("UPDATE oauthClient SET disabled = 1 WHERE clientId = ? AND userId IS NULL").bind(id).run();
  if (!result.meta.changes) throw new HTTPException(404, { message: "Registration not found" });
  await audit(c, "registration.revoked", "application", id);
  return c.json({ ok: true });
});
