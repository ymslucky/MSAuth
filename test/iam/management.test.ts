import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import app from "../../src/platform";
import { createAuth } from "../../src/iam/auth";
import { exportJWK, generateKeyPair } from "jose";
import type { Bindings } from "../../src/iam/types";
import schema from "../../migrations/0001_schema.sql?raw";
import seed from "../../migrations/0002_seed.sql?raw";

// Isolated workerd storage + rate-limit budget for management-semantics tests
// (platform.test.ts owns the big OAuth flows and its own limiter budget).
const bindings = env as unknown as Bindings;
const origin = "https://auth.test"; // reserved test domain, matches vitest.config.mts
let ownerCookie = "";
let otherCookie = "";
let ownerId = "";

async function login(email: string) {
  const auth = await createAuth(bindings);
  const context = await auth.$context;
  const user = await context.internalAdapter.createUser({ name: email.split("@")[0], email, emailVerified: true }, { method: "email-password" });
  await context.internalAdapter.createAccount({
    userId: user.id, providerId: "credential", accountId: user.id,
    password: await context.password.hash("test-passphrase-123!"),
  });
  const res = await auth.handler(new Request(origin + "/api/auth/sign-in/email", {
    method: "POST", headers: { "content-type": "application/json", origin },
    body: JSON.stringify({ email, password: "test-passphrase-123!" }),
  }));
  expect(res.status).toBe(200);
  const cookie = res.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
  return { cookie, id: user.id };
}

function request(path: string, cookie = ownerCookie, method = "GET", body?: unknown, originHeader = origin) {
  return app.request(origin + path, {
    method, headers: { cookie, origin: originHeader, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }, bindings);
}

beforeAll(async () => {
  const sql = schema + "\n" + seed;
  const statements = sql.split("\n").filter(line => !line.trimStart().startsWith("--")).join("\n").split(";").filter(s => s.trim());
  await env.AUTH_DB.batch(statements.map(s => env.AUTH_DB.prepare(s)));
  const owner = await login("root@example.com");
  ownerCookie = owner.cookie;
  ownerId = owner.id;
  otherCookie = (await login("member@example.com")).cookie;
});

describe("Management semantics", () => {
  it("acknowledges security alerts with ownership checks and an audit trail", async () => {
    const alertId = crypto.randomUUID();
    await env.AUTH_DB.prepare("INSERT INTO securityAlert (id, userId, kind, detail, createdAt) VALUES (?, ?, ?, ?, ?)")
      .bind(alertId, ownerId, "new_passkey", "{}", Date.now()).run();
    expect((await request("/api/v1/alerts/" + alertId + "/acknowledge", otherCookie, "POST", {})).status).toBe(404);
    expect((await request("/api/v1/alerts/does-not-exist/acknowledge", ownerCookie, "POST", {})).status).toBe(404);
    expect((await request("/api/v1/alerts/" + alertId + "/acknowledge", ownerCookie, "POST", {})).status).toBe(200);
    const row = await env.AUTH_DB.prepare("SELECT acknowledgedAt FROM securityAlert WHERE id = ?").bind(alertId).first<{ acknowledgedAt: number | null }>();
    expect(row?.acknowledgedAt ?? 0).toBeGreaterThan(0);
    // the previously audit-less mutation is now on the ledger
    const auditRes = await request("/api/v1/audit?actor=" + ownerId + "&resource=" + alertId);
    const auditBody = await auditRes.json() as { items: { action: string }[] };
    expect(auditBody.items.some(item => item.action === "alert.acknowledged")).toBe(true);
  });

  it("reports hostname collisions and duplicate agent bindings as conflicts", async () => {
    await request("/api/v1/domains", ownerCookie, "POST", { hostname: "conflict.example.com" });
    expect((await request("/api/v1/domains", otherCookie, "POST", { hostname: "conflict.example.com" })).status).toBe(409);
    const clientRes = await request("/api/v1/applications", ownerCookie, "POST", { name: "Dup", redirectUris: ["http://127.0.0.1:9999/callback"] });
    expect(clientRes.status).toBe(201);
    const { client_id } = await clientRes.json() as { client_id: string };
    const pair = await generateKeyPair("ES256", { extractable: true });
    const jwk = await exportJWK(pair.publicKey);
    const first = await request("/api/v1/agents", ownerCookie, "POST", { name: "First", clientId: client_id, publicJwk: jwk });
    expect(first.status, await first.clone().text()).toBe(201);
    const second = await request("/api/v1/agents", ownerCookie, "POST", { name: "Second", clientId: client_id, publicJwk: jwk });
    expect(second.status).toBe(409);
  });

  it("lets owners remove domains, freeing the hostname", async () => {
    const add = await request("/api/v1/domains", ownerCookie, "POST", { hostname: "removable.example.com" });
    expect(add.status).toBe(201);
    const domain = await add.json() as { id: string };
    expect((await request("/api/v1/domains/" + domain.id, otherCookie, "DELETE")).status).toBe(404);
    expect((await request("/api/v1/domains/" + domain.id, ownerCookie, "DELETE")).status).toBe(200);
    // the freed hostname can be registered again
    expect((await request("/api/v1/domains", ownerCookie, "POST", { hostname: "removable.example.com" })).status).toBe(201);
    const auditRes = await request("/api/v1/audit?actor=" + ownerId + "&resource=" + domain.id);
    const auditBody = await auditRes.json() as { items: { action: string }[] };
    expect(auditBody.items.some(item => item.action === "domain.removed")).toBe(true);
  });

  it("hides disabled resources from plain users while operators see everything", async () => {
    const created = await request("/api/v1/resources", ownerCookie, "POST", { name: "Disabled MCP", identifier: "https://disabled.example.com/mcp" });
    expect(created.status, await created.clone().text()).toBe(201);
    await env.AUTH_DB.prepare("UPDATE oauthResource SET disabled = 1 WHERE identifier = ?").bind("https://disabled.example.com/mcp").run();
    const userView = await request("/api/v1/resources", otherCookie);
    expect(JSON.stringify(await userView.json())).not.toContain("disabled.example.com");
    const operatorView = await request("/api/v1/resources", ownerCookie);
    expect(JSON.stringify(await operatorView.json())).toContain("disabled.example.com");
  });

  it("caps audit deep paging to a bounded offset", async () => {
    const res = await request("/api/v1/audit?page=99999", ownerCookie);
    expect(((await res.json()) as { page: number }).page).toBe(1000);
  });

  it("preserves validation reasons instead of swallowing them", async () => {
    const badCallback = await request("/api/v1/applications", ownerCookie, "POST", {
      name: "Bad", redirectUris: ["https://user:pass@example.com/callback"],
    });
    expect(badCallback.status).toBe(400);
    expect(((await badCallback.json()) as { error: string }).error).toContain("credentials");
    const badResource = await request("/api/v1/resources", ownerCookie, "POST", {
      name: "Bad", identifier: "https://user:pass@resource.example.com/mcp",
    });
    expect(badResource.status).toBe(400);
    expect(((await badResource.json()) as { error: string }).error).toContain("credentials");
  });

  it("never honors the rate-limit kill switch outside test origins", async () => {
    const prodLike = { ...bindings, BETTER_AUTH_URL: "https://auth.msxor.com", RATE_LIMIT_DISABLED: "1" };
    expect(((await createAuth(prodLike)).options.rateLimit as { enabled: boolean }).enabled).toBe(true);
    // the reserved test origin keeps the escape hatch for the workerd suite
    expect(((await createAuth(bindings)).options.rateLimit as { enabled: boolean }).enabled).toBe(false);
  });

  it("declares explicit SameSite/Path attributes on session cookies", async () => {
    const auth = await createAuth(bindings);
    const res = await auth.handler(new Request(origin + "/api/auth/sign-in/email", {
      method: "POST", headers: { "content-type": "application/json", origin },
      body: JSON.stringify({ email: "root@example.com", password: "test-passphrase-123!" }),
    }));
    expect(res.status).toBe(200);
    const cookies = res.headers.getSetCookie().join(" | ");
    expect(cookies).toMatch(/SameSite=Lax/i);
    expect(cookies).toContain("Path=/");
    expect(cookies).toMatch(/Secure/i);
  });
});
