import { describe, expect, it } from "vitest";
import { decodeJwt, decodeProtectedHeader, exportJWK, generateKeyPair, SignJWT } from "jose";
import { AgentClient, createProtectedResourceMetadata, authorizeToolCall } from "../../sdk/index";

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
});
