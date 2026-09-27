import { describe, expect, it, vi, afterEach } from "vitest";
import { decodeJwt, decodeProtectedHeader, exportJWK, generateKeyPair, SignJWT } from "jose";
import { AgentClient, createProtectedResourceMetadata, authorizeToolCall } from "../../sdk/index";

const EXCHANGE_GRANT = "urn:ietf:params:oauth:grant-type:token-exchange";

/** Installs a fetch stub for the well-known discovery, token endpoint and resource calls. */
function stubTokenEndpoint(handlers: {
  onToken: (body: URLSearchParams, request: Request) => Response;
  onResource?: (request: Request) => Response;
}) {
  return vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const url = new URL(request.url);
    if (url.pathname.includes("well-known")) return new Response("not found", { status: 404 });
    if (url.host === "mcp.example.com") return handlers.onResource?.(request) ?? new Response("{}", { headers: { "content-type": "application/json" } });
    return handlers.onToken(new URLSearchParams(await request.text()), request);
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("runtime-independent Agent SDK", () => {
  it("creates PKCE authorization with explicit resource and DPoP thumbprint", async () => {
    const agent = await AgentClient.create({ issuer: "https://auth.test", clientId: "cli", resource: "https://mcp.example.com/mcp" });
    const flow = await agent.authorize("http://127.0.0.1:4444/callback", ["mcp:invoke"]);
    const url = new URL(flow.url);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("resource")).toBe("https://mcp.example.com/mcp");
    expect(url.searchParams.get("dpop_jkt")).toBeTruthy();
    expect(flow.state.length).toBeGreaterThanOrEqual(32);
    expect(flow.verifier.length).toBeGreaterThanOrEqual(43);
  });
  it("signs request-bound proofs without exposing private key material", async () => {
    const agent = await AgentClient.create({ issuer: "https://auth.test", clientId: "cli", resource: "https://mcp.example.com/mcp" });
    const proof = await agent.proof("POST", "https://mcp.example.com/mcp?x=1", "token");
    expect(decodeProtectedHeader(proof).typ).toBe("dpop+jwt");
    expect(decodeProtectedHeader(proof).jwk).not.toHaveProperty("d");
    expect(decodeJwt(proof)).toMatchObject({ htm: "POST", htu: "https://mcp.example.com/mcp" });
    expect(decodeJwt(proof).ath).toBeTruthy();
  });
  it("does not send an access token to another resource", async () => {
    const agent = await AgentClient.create({ issuer: "https://auth.test", clientId: "cli", resource: "https://mcp.example.com/mcp" });
    await expect(agent.fetch("https://evil.example.com/")).rejects.toThrow();
  });
  it("validates state before sending the authorization code", async () => {
    const agent = await AgentClient.create({ issuer: "https://auth.test", clientId: "cli", resource: "https://mcp.example.com/mcp" });
    const flow = await agent.authorize("http://127.0.0.1:4444/callback", ["mcp:invoke"]);
    await expect(agent.complete("http://127.0.0.1:4444/callback?state=wrong&code=x", flow)).rejects.toThrow();
  });
  it("publishes MCP protected-resource metadata without accepting arbitrary issuers", () => {
    const metadata = createProtectedResourceMetadata("https://mcp.example.com/mcp", "https://auth.test");
    expect(metadata.authorization_servers).toEqual(["https://auth.test"]);
    expect(metadata.resource).toBe("https://mcp.example.com/mcp");
  });
  it("enforces tool, action, audience and expiry at the resource server", () => {
    const claims = {
      aud: "https://mcp.example.com/mcp", exp: Math.floor(Date.now() / 1000) + 60, scope: "mcp:invoke",
      authorization_details: [{ type: "mcp_tool", locations: ["https://mcp.example.com/mcp"], actions: ["read"], identifiers: ["notes"] }],
    };
    expect(() => authorizeToolCall(claims, "https://mcp.example.com/mcp", "notes", "read")).not.toThrow();
    expect(() => authorizeToolCall(claims, "https://mcp.example.com/mcp", "notes", "delete")).toThrow();
    expect(() => authorizeToolCall(claims, "https://other.example.com/mcp", "notes", "read")).toThrow();
    expect(() => authorizeToolCall({ ...claims, exp: 1 }, claims.aud, "notes", "read")).toThrow();
  });

  it("fails closed on malformed claims instead of crashing", () => {
    const soon = Math.floor(Date.now() / 1000) + 60;
    const resource = "https://mcp.example.com/mcp";
    // string-shaped authorization_details must be a rejection, not a TypeError
    expect(() => authorizeToolCall({ aud: resource, exp: soon, authorization_details: "garbage" }, resource, "notes", "read")).toThrow();
    // detail entries missing their lists must be a rejection, not a crash
    expect(() => authorizeToolCall({ aud: resource, exp: soon, authorization_details: [{ type: "mcp_tool" }] }, resource, "notes", "read")).toThrow();
    // a not-yet-valid token is rejected
    expect(() => authorizeToolCall({ aud: resource, exp: soon, nbf: soon }, resource, "notes", "read")).toThrow();
    const valid = [{ type: "mcp_tool", locations: [resource], actions: ["read"], identifiers: ["notes"] }];
    expect(() => authorizeToolCall({ aud: resource, exp: soon, nbf: Math.floor(Date.now() / 1000) - 60, authorization_details: valid }, resource, "notes", "read")).not.toThrow();
  });

  it("rejects authorization responses minted by a different issuer", async () => {
    const agent = await AgentClient.create({ issuer: "https://auth.test", clientId: "cli", resource: "https://mcp.example.com/mcp" });
    const flow = await agent.authorize("http://127.0.0.1:4444/callback", ["mcp:invoke"]);
    const callback = "http://127.0.0.1:4444/callback?state=" + flow.state + "&code=x&iss=" + encodeURIComponent("https://evil.test");
    await expect(agent.complete(callback, flow)).rejects.toThrow(/issuer/);
  });

  it("keeps the DPoP signing key non-extractable", async () => {
    const agent = await AgentClient.create({ issuer: "https://auth.test", clientId: "cli", resource: "https://mcp.example.com/mcp" });
    const key = (agent as unknown as { keyPair: CryptoKeyPair }).keyPair.privateKey;
    await expect(crypto.subtle.exportKey("jwk", key)).rejects.toThrow();
    // signing still works — proof() exercises the same key
    await expect(agent.proof("POST", "https://mcp.example.com/mcp")).resolves.toBeTruthy();
  });

  it("exchange returns the delegated token without clobbering the user token set", async () => {
    const agent = await AgentClient.create({ issuer: "https://auth.test", clientId: "cli", resource: "https://mcp.example.com/mcp" });
    const flow = await agent.authorize("http://127.0.0.1:4444/callback", ["mcp:invoke"]);
    let seenAuthorization = "";
    let refreshBody: URLSearchParams | undefined;
    stubTokenEndpoint({
      onToken: (body) => {
        if (body.get("grant_type") === "authorization_code") {
          return Response.json({ access_token: "user-at", refresh_token: "user-rt", token_type: "DPoP", expires_in: 300 });
        }
        if (body.get("grant_type") === EXCHANGE_GRANT) {
          return Response.json({ access_token: "delegated-at", token_type: "DPoP", expires_in: 300, issued_token_type: "urn:ietf:params:oauth:token-type:access_token" });
        }
        refreshBody = body;
        return Response.json({ access_token: "user-at-2", refresh_token: "user-rt-2", token_type: "DPoP", expires_in: 300 });
      },
      onResource: (request) => {
        seenAuthorization = request.headers.get("authorization") ?? "";
        return new Response("{}", { headers: { "content-type": "application/json" } });
      },
    });
    await agent.complete("http://127.0.0.1:4444/callback?state=" + flow.state + "&code=abc", flow);
    const delegated = await agent.exchange("del_1", "user-at");
    expect(delegated.access_token).toBe("delegated-at");
    expect(delegated.issued_token_type).toBe("urn:ietf:params:oauth:token-type:access_token");
    // resource calls still carry the USER token, never the delegated one
    await agent.fetch("https://mcp.example.com/mcp");
    expect(seenAuthorization).toBe("DPoP user-at");
    // and the user refresh token survived the exchange untouched
    const rotated = await agent.refresh();
    expect(rotated.access_token).toBe("user-at-2");
    expect(refreshBody?.get("refresh_token")).toBe("user-rt");
  });

  it("coalesces concurrent refreshes into a single rotation", async () => {
    const agent = await AgentClient.create({ issuer: "https://auth.test", clientId: "cli", resource: "https://mcp.example.com/mcp" });
    const flow = await agent.authorize("http://127.0.0.1:4444/callback", ["mcp:invoke"]);
    let tokenPosts = 0;
    stubTokenEndpoint({
      onToken: (body) => {
        if (body.get("grant_type") === "authorization_code") {
          // expires_in: 1 puts the token inside the auto-refresh window
          return Response.json({ access_token: "at1", refresh_token: "rt1", token_type: "DPoP", expires_in: 1 });
        }
        tokenPosts++;
        return Response.json({ access_token: "at2", refresh_token: "rt2", token_type: "DPoP", expires_in: 300 });
      },
    });
    await agent.complete("http://127.0.0.1:4444/callback?state=" + flow.state + "&code=abc", flow);
    await Promise.all([agent.fetch("https://mcp.example.com/mcp"), agent.fetch("https://mcp.example.com/mcp")]);
    expect(tokenPosts).toBe(1);
  });
});
