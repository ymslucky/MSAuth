import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import app from "../../src/platform";
import { createAuth } from "../../src/iam/auth";
import type { Bindings } from "../../src/iam/types";
import schema from "../../migrations/0001_schema.sql?raw";
import seed from "../../migrations/0002_seed.sql?raw";
import { calculateJwkThumbprint, decodeJwt, exportJWK, generateKeyPair, SignJWT } from "jose";
import { EXCHANGE_GRANT } from "../../src/agent/exchange";

const bindings = env as unknown as Bindings;
const origin = "https://auth.example.com";
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

describe("IAM platform boundaries", () => {
  it("publishes actual OAuth discovery including S256, DPoP and token exchange", async () => {
    const res = await request("/.well-known/oauth-authorization-server");
    expect(res.status).toBe(200);
    const metadata = await res.json() as Record<string, unknown>;
    expect(metadata.issuer).toBe(origin);
    expect(metadata.code_challenge_methods_supported).toEqual(["S256"]);
    expect(metadata.grant_types_supported).toContain("urn:ietf:params:oauth:grant-type:token-exchange");
    expect(metadata.dpop_signing_alg_values_supported).toContain("ES256");
  });
  it("requires a real session, never an API key, for management", async () => {
    expect((await request("/api/v1/overview", "")).status).toBe(401);
    expect((await app.request(origin + "/api/v1/overview", { headers: { authorization: "Bearer msa_fake" } }, bindings)).status).toBe(401);
  });
  it("rejects cross-origin mutations", async () => {
    expect((await request("/api/v1/agents", ownerCookie, "POST", {}, "https://evil.example")).status).toBe(403);
  });
  it("isolates developer-owned resources", async () => {
    const created = await request("/api/v1/agents", ownerCookie, "POST", {
      name: "Notes assistant", description: "Personal automation",
    });
    expect(created.status).toBe(201);
    const agent = await created.json() as { id: string; ownerId: string };
    expect(agent.ownerId).toBe(ownerId);
    const otherList = await request("/api/v1/agents", otherCookie);
    expect(JSON.stringify(await otherList.json())).not.toContain(agent.id);
    expect((await request("/api/v1/agents/" + agent.id, otherCookie, "DELETE")).status).toBe(404);
    expect((await request("/api/v1/agents/" + agent.id, ownerCookie, "DELETE")).status).toBe(200);
  });
  it("keeps platform users and global configuration operator-only", async () => {
    expect((await request("/api/v1/users", otherCookie)).status).toBe(403);
    expect((await request("/api/v1/users")).status).toBe(200);
    expect((await request("/api/v1/settings", otherCookie, "PATCH", { registrationEnabled: false })).status).toBe(403);
  });
  it("never falls back to SPA HTML for unknown API routes", async () => {
    const res = await request("/api/v1/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("application/json");
  });
  it("records mutations in an actor-filterable audit log", async () => {
    const res = await request("/api/v1/audit?actor=" + ownerId);
    const body = await res.json() as { items: { actorId: string; action: string }[] };
    expect(body.items.some(row => row.action === "agent.created")).toBe(true);
    expect(body.items.every(row => row.actorId === ownerId)).toBe(true);
  });
  it("revokes the server-side session on logout", async () => {
    const disposable = await login("logout@example.com");
    const res = await request("/api/auth/sign-out", disposable.cookie, "POST", {});
    expect(res.status).toBe(200);
    expect((await request("/api/v1/overview", disposable.cookie)).status).toBe(401);
  });
  it("supports security settings, session management and self-service profile keys", async () => {
    expect((await request("/api/v1/sessions")).status).toBe(200);
    expect((await request("/api/v1/alerts")).status).toBe(200);
    expect((await request("/api/v1/settings")).status).toBe(200);
    expect((await request("/api/v1/domains", ownerCookie, "POST", { hostname: "example.com" })).status).toBe(201);
    expect((await request("/api/v1/domains", ownerCookie, "POST", { hostname: "http://127.0.0.1" })).status).toBe(400);
    expect((await request("/api/auth/admin/list-users", otherCookie)).status).toBe(404);
  });
});

describe("OAuth and Agent integration", () => {
  it("supports application, key and resource management with owner isolation", async () => {
    const res = await request("/api/v1/applications", ownerCookie, "POST", {
      name: "CLI", redirectUris: ["http://127.0.0.1:54321/callback"], dpop: true,
    });
    expect(res.status, await res.clone().text()).toBe(201);
    const client = await res.json() as { client_id: string };
    expect((await request("/api/v1/applications/" + client.client_id, otherCookie, "DELETE")).status).toBeGreaterThanOrEqual(400);
    const keyRes = await request("/api/v1/keys", ownerCookie, "POST", { name: "Automation" });
    expect(keyRes.status, await keyRes.clone().text()).toBe(201);
    const key = await keyRes.json() as { id: string; key: string };
    expect(key.key).toMatch(/^msa_/);
    expect((await request("/api/v1/keys/" + key.id, otherCookie, "DELETE")).status).toBeGreaterThanOrEqual(400);
    const keys = await request("/api/v1/keys");
    expect(JSON.stringify(await keys.json())).not.toContain(key.key);
    expect((await request("/api/v1/overview")).status).toBe(200);
    expect((await request("/api/v1/keys/" + key.id, ownerCookie, "DELETE")).status).toBe(200);
  });

  it("runs PKCE consent, DPoP, RAR exchange, replay rejection and refresh rotation", async () => {
    const resource = "https://mcp.example.com/mcp";
    const pair = await generateKeyPair("ES256", { extractable: true });
    const jwk = await exportJWK(pair.publicKey);
    const jkt = await calculateJwkThumbprint(jwk);
    const proof = () => new SignJWT({ htm: "POST", htu: origin + "/api/auth/oauth2/token" })
      .setProtectedHeader({ typ: "dpop+jwt", alg: "ES256", jwk }).setIssuedAt().setJti(crypto.randomUUID()).sign(pair.privateKey);
    const clientResponse = await request("/api/v1/applications", ownerCookie, "POST", {
      name: "Agent runtime", redirectUris: ["http://127.0.0.1:5555/callback"], dpop: true,
    });
    expect(clientResponse.status, await clientResponse.clone().text()).toBe(201);
    const client = await clientResponse.json() as { client_id: string };
    expect((await request("/api/v1/resources", ownerCookie, "POST", { name: "Notes MCP", identifier: resource })).status).toBe(201);
    const linked = await request("/api/v1/resources/link", ownerCookie, "POST", { identifier: resource, clientId: client.client_id });
    expect(linked.status).toBe(200);
    const agentRes = await request("/api/v1/agents", ownerCookie, "POST", { name: "Writer", clientId: client.client_id, publicJwk: jwk });
    expect(agentRes.status).toBe(201);
    const agent = await agentRes.json() as { id: string };
    const details = [{ type: "mcp_tool", locations: [resource], actions: ["read"], identifiers: ["notes"] }];
    const delegationRes = await request("/api/v1/delegations", ownerCookie, "POST", {
      agentId: agent.id, resource, scopes: ["mcp:invoke"], authorizationDetails: details, expiresAt: Date.now() + 3600000,
    });
    expect(delegationRes.status, await delegationRes.clone().text()).toBe(201);
    const delegation = await delegationRes.json() as { id: string };
    const verifier = "a".repeat(64);
    const challenge = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)))))
      .replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
    const authorizeQuery = new URLSearchParams({
      client_id: client.client_id, redirect_uri: "http://127.0.0.1:5555/callback", response_type: "code",
      scope: "offline_access mcp:invoke", resource, code_challenge: challenge, code_challenge_method: "S256", state: "test-state", dpop_jkt: jkt,
    });
    const authorize = await request("/api/auth/oauth2/authorize?" + authorizeQuery);
    expect(authorize.status).toBe(302);
    const consentURL = new URL(authorize.headers.get("location")!, origin);
    expect(consentURL.pathname).toBe("/consent");
    const consent = await request("/api/auth/oauth2/consent", ownerCookie, "POST", { accept: true, oauth_query: consentURL.search.slice(1) });
    expect(consent.status).toBe(200);
    const consentBody = await consent.json() as { redirect_uri?: string; url?: string };
    const callback = new URL(consentBody.redirect_uri ?? consentBody.url!);
    const code = callback.searchParams.get("code")!;
    expect(callback.searchParams.get("state")).toBe("test-state");
    const token = async (fields: Record<string, string>, dpop = "") => app.request(origin + "/api/auth/oauth2/token", {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", dpop },
      body: new URLSearchParams(fields),
    }, bindings);
    const exchangeCode = await token({
      grant_type: "authorization_code", client_id: client.client_id, code, code_verifier: verifier,
      redirect_uri: "http://127.0.0.1:5555/callback", resource,
    }, await proof());
    expect(exchangeCode.status).toBe(200);
    const tokens = await exchangeCode.json() as { access_token: string; refresh_token: string; token_type: string };
    expect(tokens.token_type).toBe("DPoP");
    expect(decodeJwt(tokens.access_token).aud).toBe(resource);
    expect(decodeJwt(tokens.access_token).cnf).toEqual({ jkt });
    const fields = {
      grant_type: EXCHANGE_GRANT, client_id: client.client_id, subject_token: tokens.access_token,
      subject_token_type: "urn:ietf:params:oauth:token-type:access_token", delegation_id: delegation.id,
      resource, scope: "mcp:invoke", authorization_details: JSON.stringify(details),
    };
    const dpop = await proof();
    const exchanged = await token(fields, dpop);
    expect(exchanged.status).toBe(200);
    const delegated = await exchanged.json() as { access_token: string; issued_token_type: string };
    const claims = decodeJwt(delegated.access_token);
    expect(claims.authorization_details).toEqual(details);
    expect(claims.act).toEqual({ sub: agent.id });
    expect(claims.exp).toBeLessThanOrEqual(decodeJwt(tokens.access_token).exp!);
    expect((await token(fields, dpop)).status).toBe(400);
    expect((await token({ ...fields, resource: "https://other.example.com/mcp" }, await proof())).status).toBe(400);
    expect((await token({ ...fields, scope: "agent:delegate" }, await proof())).status).toBe(400);
    const refresh = await token({ grant_type: "refresh_token", client_id: client.client_id, refresh_token: tokens.refresh_token, resource }, await proof());
    expect(refresh.status).toBe(200);
    const rotated = await refresh.json() as { refresh_token: string };
    expect(rotated.refresh_token).not.toBe(tokens.refresh_token);
    expect((await request("/api/v1/delegations/" + delegation.id, ownerCookie, "DELETE")).status).toBe(200);
    expect((await token(fields, await proof())).status).toBe(400);
  });
});
