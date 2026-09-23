import { describe, expect, it } from "vitest";
import { narrowAuthorization, parseAuthorization, validateResource, validateRedirect } from "../../src/agent/policy";

const resource = "https://mcp.example.com/mcp";
const parent = [{ type: "mcp_tool", locations: [resource], actions: ["read", "write"], identifiers: ["notes", "tasks"] }];

describe("Agent authorization policy", () => {
  it("accepts explicit, structured MCP permissions", () => {
    expect(parseAuthorization(parent)).toEqual(parent);
  });
  it("allows only a subset of an existing delegation", () => {
    expect(narrowAuthorization(parent, [{ ...parent[0], actions: ["read"], identifiers: ["notes"] }])).toHaveLength(1);
  });
  it.each([
    [{ ...parent[0], actions: ["delete"] }],
    [{ ...parent[0], locations: ["https://other.example.com/mcp"] }],
    [{ ...parent[0], identifiers: ["*"] }],
    [{ ...parent[0], identifiers: ["secrets"] }],
  ])("rejects authority amplification: %j", (child) => {
    expect(() => narrowAuthorization(parent, [child])).toThrow();
  });
  it("does not combine unrelated grants into a broader grant", () => {
    const separate = [
      { ...parent[0], actions: ["read"], identifiers: ["notes"] },
      { ...parent[0], actions: ["write"], identifiers: ["tasks"] },
    ];
    expect(() => narrowAuthorization(separate, parent)).toThrow();
  });
  it.each([
    { detail: [{ ...parent[0], type: "unknown" }] },
    { detail: [{ ...parent[0], actions: [] }] },
    { detail: [{ ...parent[0], wildcard: true }] },
    { detail: [{ ...parent[0], locations: ["http://127.0.0.1/mcp"] }] },
    { detail: [] },
  ])("rejects ambiguous or unsupported RAR: %j", ({ detail }) => {
    expect(() => parseAuthorization(detail)).toThrow();
  });
  it("accepts HTTPS resources and loopback native redirects only", () => {
    expect(validateResource(resource)).toBe(resource);
    expect(validateRedirect("http://127.0.0.1:54321/callback")).toContain("54321");
    for (const value of ["javascript:alert(1)", "https://x.test/#fragment", "https://u:p@x.test/", "https://*.example.com/"]) {
      expect(() => validateRedirect(value)).toThrow();
    }
    expect(() => validateResource("http://mcp.example.com")).toThrow();
  });
});
