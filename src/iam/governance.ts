import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "./types";
import { audit, auditStatement, body, page, requireOperator, text } from "./http";

export const governanceRoutes = new Hono<AppEnv>();

governanceRoutes.get("/overview", async c => {
  const id = c.get("identity").user.id;
  const queries = [
    ['applications', 'SELECT COUNT(*) AS count FROM oauthClient WHERE userId = ?'],
    ['agents', 'SELECT COUNT(*) AS count FROM agent WHERE ownerId = ? AND status = \'active\''],
    ['delegations', 'SELECT COUNT(*) AS count FROM delegation WHERE ownerId = ? AND revokedAt IS NULL AND expiresAt > ?'],
    ['keys', 'SELECT COUNT(*) AS count FROM apikey WHERE referenceId = ? AND enabled = 1'],
  ] as const;
  const counts = await Promise.all(queries.map(async ([key, sql]) => {
    const row = await c.env.AUTH_DB.prepare(sql).bind(...(key === "delegations" ? [id, Date.now()] : [id])).first<{ count: number }>();
    return [key, row?.count ?? 0];
  }));
  const activity = await c.env.AUTH_DB.prepare("SELECT * FROM auditEvent WHERE actorId = ? ORDER BY createdAt DESC LIMIT 8").bind(id).all();
  const usage = await c.env.AUTH_DB.prepare("SELECT strftime('%Y-%m-%d', createdAt / 1000, 'unixepoch') AS day, COUNT(*) AS count FROM auditEvent WHERE actorId = ? AND action = 'token.exchanged' AND createdAt > ? GROUP BY day ORDER BY day")
    .bind(id, Date.now() - 7 * 86400000).all();
  return c.json({ counts: Object.fromEntries(counts), activity: activity.results, usage: usage.results, user: c.get("identity").user, operator: c.get("operator") });
});

governanceRoutes.get("/audit", async c => {
  const paging = page(c);
  const actor = c.get("operator") ? c.req.query("actor") ?? "" : c.get("identity").user.id;
  const resource = (c.req.query("resource") ?? "").slice(0, 200);
  // actor filter accepts a raw user id or an email; rows always carry the
  // resolved identity so the console never renders a bare UUID
  const where = 'WHERE (? = \'\' OR auditEvent.actorId = ? OR auditEvent.actorId = (SELECT id FROM "user" WHERE lower(email) = lower(?))) AND (? = \'\' OR resourceType = ? OR resourceId = ?)';
  const values = [actor, actor, actor, resource, resource, resource];
  const [rows, count] = await Promise.all([
    c.env.AUTH_DB.prepare(`SELECT auditEvent.*, u.email AS actorEmail, u.name AS actorName FROM auditEvent LEFT JOIN "user" u ON u.id = auditEvent.actorId ${where} ORDER BY auditEvent.createdAt DESC, auditEvent.id DESC LIMIT ? OFFSET ?`).bind(...values, paging.limit, paging.offset).all(),
    c.env.AUTH_DB.prepare(`SELECT COUNT(*) AS total FROM auditEvent ${where}`).bind(...values).first<{ total: number }>(),
  ]);
  return c.json({ items: rows.results, total: count?.total ?? 0, page: paging.number });
});

governanceRoutes.get("/users", async c => {
  requireOperator(c);
  const paging = page(c);
  const q = (c.req.query("q") ?? "").slice(0, 100);
  const items = await c.env.AUTH_DB.prepare('SELECT id, name, email, emailVerified, image, banned, twoFactorEnabled, createdAt FROM "user" WHERE email LIKE ? OR name LIKE ? ORDER BY createdAt DESC LIMIT ? OFFSET ?')
    .bind(`%${q}%`, `%${q}%`, paging.limit, paging.offset).all();
  const count = await c.env.AUTH_DB.prepare('SELECT COUNT(*) AS total FROM "user" WHERE email LIKE ? OR name LIKE ?').bind(`%${q}%`, `%${q}%`).first();
  return c.json({ items: items.results, ...count, page: paging.number });
});

governanceRoutes.get("/users/:id", async c => {
  requireOperator(c);
  const id = c.req.param("id");
  const user = await c.env.AUTH_DB.prepare('SELECT id, name, email, emailVerified, banned, twoFactorEnabled, createdAt FROM "user" WHERE id = ?').bind(id).first();
  if (!user) throw new HTTPException(404, { message: "User not found" });
  const sessions = await c.env.AUTH_DB.prepare('SELECT id, ipAddress, userAgent, createdAt, expiresAt FROM session WHERE userId = ?').bind(id).all();
  const accounts = await c.env.AUTH_DB.prepare('SELECT id, providerId, accountId, createdAt FROM account WHERE userId = ?').bind(id).all();
  return c.json({ user, sessions: sessions.results, accounts: accounts.results });
});

governanceRoutes.post("/users/:id/ban", async c => {
  requireOperator(c);
  const id = c.req.param("id");
  if (id === c.get("identity").user.id) throw new HTTPException(400, { message: "Cannot suspend yourself" });
  const input = await body(c);
  await c.get("auth").api.banUser({ headers: c.req.raw.headers, body: { userId: id, banReason: text(input.reason, "reason", 300) } });
  await c.env.AUTH_DB.batch([
    c.env.AUTH_DB.prepare("UPDATE agent SET status = 'revoked' WHERE ownerId = ?").bind(id),
    c.env.AUTH_DB.prepare("UPDATE delegation SET revokedAt = ? WHERE ownerId = ?").bind(Date.now(), id),
    c.env.AUTH_DB.prepare("UPDATE oauthClient SET disabled = 1 WHERE userId = ?").bind(id),
    c.env.AUTH_DB.prepare("DELETE FROM oauthRefreshToken WHERE userId = ?").bind(id),
    c.env.AUTH_DB.prepare("UPDATE apikey SET enabled = 0 WHERE referenceId = ?").bind(id),
    auditStatement(c, "user.suspended", "user", id),
  ]);
  return c.json({ ok: true });
});

governanceRoutes.post("/users/:id/unban", async c => {
  requireOperator(c);
  await c.get("auth").api.unbanUser({ headers: c.req.raw.headers, body: { userId: c.req.param("id") } });
  await audit(c, "user.unsuspended", "user", c.req.param("id"));
  return c.json({ ok: true });
});

governanceRoutes.get("/sessions", async c => {
  const rows = await c.env.AUTH_DB.prepare("SELECT id, ipAddress, userAgent, createdAt, expiresAt FROM session WHERE userId = ? ORDER BY createdAt DESC").bind(c.get("identity").user.id).all();
  return c.json({ items: rows.results, currentId: c.get("identity").session.id });
});

governanceRoutes.delete("/sessions/:id", async c => {
  const row = await c.env.AUTH_DB.prepare("SELECT token FROM session WHERE id = ? AND userId = ?").bind(c.req.param("id"), c.get("identity").user.id).first<{ token: string }>();
  if (!row) throw new HTTPException(404, { message: "Session not found" });
  await c.get("auth").api.revokeSession({ headers: c.req.raw.headers, body: { token: row.token } });
  await audit(c, "session.revoked", "session", c.req.param("id"));
  return c.json({ ok: true });
});

governanceRoutes.get("/alerts", async c => {
  const result = await c.env.AUTH_DB.prepare("SELECT * FROM securityAlert WHERE userId = ? ORDER BY createdAt DESC LIMIT 100").bind(c.get("identity").user.id).all();
  return c.json({ items: result.results });
});

governanceRoutes.post("/alerts/:id/acknowledge", async c => {
  await c.env.AUTH_DB.prepare("UPDATE securityAlert SET acknowledgedAt = ? WHERE id = ? AND userId = ?").bind(Date.now(), c.req.param("id"), c.get("identity").user.id).run();
  return c.json({ ok: true });
});

governanceRoutes.get("/settings", async c => {
  requireOperator(c);
  const result = await c.env.AUTH_DB.prepare("SELECT * FROM platformSetting").all<{ key: string; value: string }>();
  return c.json({ ...Object.fromEntries(result.results.map(row => [row.key, JSON.parse(row.value)])), issuer: c.env.BETTER_AUTH_URL, billing: "not_configured" });
});

governanceRoutes.patch("/settings", async c => {
  requireOperator(c);
  const input = await body(c);
  const statements = [];
  for (const key of Object.keys(input)) {
    if (!["registrationEnabled", "dcrEnabled"].includes(key) || typeof input[key] !== "boolean") throw new HTTPException(400, { message: "Unknown setting or invalid value" });
    statements.push(c.env.AUTH_DB.prepare("INSERT INTO platformSetting (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(key, JSON.stringify(input[key])));
  }
  await c.env.AUTH_DB.batch([...statements, auditStatement(c, "settings.updated", "platform", "settings", input)]);
  return c.json({ ok: true });
});

governanceRoutes.get("/domains", async c => {
  const result = await c.env.AUTH_DB.prepare("SELECT * FROM verifiedDomain WHERE ownerId = ? ORDER BY createdAt DESC").bind(c.get("identity").user.id).all();
  return c.json({ items: result.results });
});

governanceRoutes.post("/domains", async c => {
  const input = await body(c);
  const hostname = text(input.hostname, "hostname", 253).toLowerCase();
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(hostname)) throw new HTTPException(400, { message: "Enter a public domain name" });
  const id = crypto.randomUUID();
  const challenge = "msauth-verification=" + crypto.randomUUID();
  await c.env.AUTH_DB.batch([
    c.env.AUTH_DB.prepare("INSERT INTO verifiedDomain (id, ownerId, hostname, challenge, createdAt) VALUES (?, ?, ?, ?, ?)").bind(id, c.get("identity").user.id, hostname, challenge, Date.now()),
    auditStatement(c, "domain.added", "domain", id, { hostname }),
  ]);
  return c.json({ id, hostname, challenge, record: "_msauth." + hostname }, 201);
});

governanceRoutes.post("/domains/:id/verify", async c => {
  const row = await c.env.AUTH_DB.prepare("SELECT hostname, challenge FROM verifiedDomain WHERE id = ? AND ownerId = ?").bind(c.req.param("id"), c.get("identity").user.id).first<{ hostname: string; challenge: string }>();
  if (!row) throw new HTTPException(404, { message: "Domain not found" });
  const response = await fetch("https://cloudflare-dns.com/dns-query?" + new URLSearchParams({ name: "_msauth." + row.hostname, type: "TXT" }), { headers: { accept: "application/dns-json" }, signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new HTTPException(502, { message: "DNS resolver unavailable" });
  const dns = await response.json() as { Answer?: { type: number; data: string }[] };
  if (!dns.Answer?.some(answer => answer.type === 16 && answer.data.replaceAll('"', "") === row.challenge)) throw new HTTPException(400, { message: "TXT record not found yet" });
  await c.env.AUTH_DB.batch([
    c.env.AUTH_DB.prepare("UPDATE verifiedDomain SET verifiedAt = ? WHERE id = ?").bind(Date.now(), c.req.param("id")),
    auditStatement(c, "domain.verified", "domain", c.req.param("id")),
  ]);
  return c.json({ ok: true });
});
