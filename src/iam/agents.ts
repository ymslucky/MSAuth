import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { calculateJwkThumbprint, importJWK } from "jose";
import type { AppEnv } from "./types";
import { auditStatement, body, list, text } from "./http";
import { activeDelegation, type Delegation } from "../agent/exchange";
import { narrowAuthorization, parseAuthorization, subset, validateResource } from "../agent/policy";
import { OAUTH_SCOPES } from "./auth";

export const agentRoutes = new Hono<AppEnv>();

agentRoutes.get("/agents", async c => {
  const result = await c.env.AUTH_DB.prepare("SELECT * FROM agent WHERE ownerId = ? ORDER BY createdAt DESC LIMIT 200").bind(c.get("identity").user.id).all();
  return c.json({ items: result.results });
});

agentRoutes.post("/agents", async c => {
  const input = await body(c);
  const id = crypto.randomUUID();
  const ownerId = c.get("identity").user.id;
  const name = text(input.name, "name");
  const description = input.description === undefined ? "" : text(input.description, "description", 500);
  let dpopJkt: string | null = null;
  let clientId: string | null = null;
  if (input.clientId || input.publicJwk) {
    clientId = text(input.clientId, "clientId", 256);
    const client = await c.env.AUTH_DB.prepare("SELECT clientId FROM oauthClient WHERE clientId = ? AND userId = ? AND (disabled IS NULL OR disabled = 0)")
      .bind(clientId, ownerId).first();
    if (!client) throw new HTTPException(400, { message: "Choose an active OAuth application you own" });
    const jwk = input.publicJwk as Record<string, unknown> | undefined;
    if (!jwk || jwk.kty !== "EC" || jwk.crv !== "P-256" || "d" in jwk || typeof jwk.x !== "string" || typeof jwk.y !== "string") {
      throw new HTTPException(400, { message: "Expected a public P-256 JWK, never a private key" });
    }
    try {
      await importJWK(jwk, "ES256");
      dpopJkt = await calculateJwkThumbprint(jwk);
    } catch { throw new HTTPException(400, { message: "Invalid public key" }); }
  }
  await c.env.AUTH_DB.batch([
    c.env.AUTH_DB.prepare("INSERT INTO agent (id, ownerId, name, description, clientId, dpopJkt, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(id, ownerId, name, description, clientId, dpopJkt, Date.now()),
    auditStatement(c, "agent.created", "agent", id, { name, clientId, dpopJkt }),
  ]);
  return c.json({ id, ownerId, name, description, clientId, dpopJkt, status: "active" }, 201);
});

agentRoutes.delete("/agents/:id", async c => {
  const id = c.req.param("id");
  const agent = await c.env.AUTH_DB.prepare("SELECT id, clientId FROM agent WHERE id = ? AND ownerId = ?")
    .bind(id, c.get("identity").user.id).first<{ id: string; clientId: string | null }>();
  if (!agent) throw new HTTPException(404, { message: "Agent not found" });
  const statements = [
    c.env.AUTH_DB.prepare("UPDATE agent SET status = 'revoked' WHERE id = ?").bind(id),
    c.env.AUTH_DB.prepare("UPDATE delegation SET revokedAt = ? WHERE agentId = ?").bind(Date.now(), id),
    auditStatement(c, "agent.revoked", "agent", id),
  ];
  if (agent.clientId) {
    statements.push(c.env.AUTH_DB.prepare("UPDATE oauthClient SET disabled = 1 WHERE clientId = ?").bind(agent.clientId));
    statements.push(c.env.AUTH_DB.prepare("DELETE FROM oauthRefreshToken WHERE clientId = ?").bind(agent.clientId));
    statements.push(c.env.AUTH_DB.prepare("DELETE FROM oauthAccessToken WHERE clientId = ?").bind(agent.clientId));
  }
  await c.env.AUTH_DB.batch(statements);
  return c.json({ ok: true });
});

agentRoutes.get("/delegations", async c => {
  const result = await c.env.AUTH_DB.prepare("SELECT d.*, a.name AS agentName FROM delegation d JOIN agent a ON a.id = d.agentId WHERE d.ownerId = ? ORDER BY d.createdAt DESC LIMIT 200")
    .bind(c.get("identity").user.id).all<Delegation & { agentName: string }>();
  return c.json({ items: result.results.map(row => ({ ...row, scopes: JSON.parse(row.scopes), authorizationDetails: JSON.parse(row.authorizationDetails) })) });
});

agentRoutes.post("/delegations", async c => {
  const input = await body(c);
  const ownerId = c.get("identity").user.id;
  const agentId = text(input.agentId, "agentId");
  const agent = await c.env.AUTH_DB.prepare("SELECT id, clientId, dpopJkt FROM agent WHERE id = ? AND ownerId = ? AND status = 'active'")
    .bind(agentId, ownerId).first<{ id: string; clientId: string | null; dpopJkt: string | null }>();
  if (!agent?.clientId || !agent.dpopJkt) throw new HTTPException(400, { message: "Bind an active OAuth client and DPoP key first" });
  let resource: string;
  let details;
  try { resource = validateResource(text(input.resource, "resource", 2048)); details = parseAuthorization(input.authorizationDetails); }
  catch { throw new HTTPException(400, { message: "Invalid resource or authorization details" }); }
  if (details.some(detail => detail.locations.length !== 1 || detail.locations[0] !== resource)) throw new HTTPException(400, { message: "Every permission must target the exact resource" });
  const resourceRow = await c.env.AUTH_DB.prepare("SELECT r.id FROM oauthResource r JOIN oauthClientResource cr ON cr.resourceId = r.identifier WHERE r.identifier = ? AND cr.clientId = ? AND r.disabled = 0")
    .bind(resource, agent.clientId).first();
  if (!resourceRow) throw new HTTPException(400, { message: "Resource is not linked to the agent application" });
  const scopes = list(input.scopes, "scopes");
  if (!scopes.length || !subset(scopes, OAUTH_SCOPES.filter(s => !["offline_access", "openid", "profile", "email"].includes(s)))) throw new HTTPException(400, { message: "Invalid agent scopes" });
  const expiresAt = Number(input.expiresAt);
  if (!Number.isSafeInteger(expiresAt) || expiresAt < Date.now() + 60000 || expiresAt > Date.now() + 30 * 86400000) throw new HTTPException(400, { message: "Delegations expire between one minute and 30 days" });
  let parentId: string | null = null;
  let depth = 0;
  if (input.parentId) {
    parentId = text(input.parentId, "parentId");
    const parent = await activeDelegation(c.env.AUTH_DB, parentId);
    if (!parent || parent.ownerId !== ownerId || parent.resource !== resource || parent.agentId !== agentId ||
      parent.depth >= 4 || expiresAt > parent.expiresAt || !subset(scopes, JSON.parse(parent.scopes))) {
      throw new HTTPException(400, { message: "Child delegation exceeds parent authority" });
    }
    try { details = narrowAuthorization(JSON.parse(parent.authorizationDetails), details); }
    catch { throw new HTTPException(400, { message: "Child permissions exceed parent authority" }); }
    depth = parent.depth + 1;
  }
  const id = crypto.randomUUID();
  await c.env.AUTH_DB.batch([
    c.env.AUTH_DB.prepare("INSERT INTO delegation (id, ownerId, agentId, parentId, resource, scopes, authorizationDetails, expiresAt, depth, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(id, ownerId, agentId, parentId, resource, JSON.stringify(scopes), JSON.stringify(details), expiresAt, depth, Date.now()),
    auditStatement(c, "delegation.created", "delegation", id, { agentId, resource, parentId, scopes }),
  ]);
  return c.json({ id, depth, expiresAt }, 201);
});

agentRoutes.delete("/delegations/:id", async c => {
  const id = c.req.param("id");
  const row = await c.env.AUTH_DB.prepare("SELECT id FROM delegation WHERE id = ? AND ownerId = ?").bind(id, c.get("identity").user.id).first();
  if (!row) throw new HTTPException(404, { message: "Delegation not found" });
  await c.env.AUTH_DB.batch([
    c.env.AUTH_DB.prepare("UPDATE delegation SET revokedAt = ? WHERE id = ?").bind(Date.now(), id),
    auditStatement(c, "delegation.revoked", "delegation", id),
  ]);
  return c.json({ ok: true });
});
