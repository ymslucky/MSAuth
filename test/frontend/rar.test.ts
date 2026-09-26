import { describe, expect, it } from "vitest";
import { buildAuthorizationDetail, isValidResource, parseListInput } from "../../frontend/src/rar";

describe("parseListInput — free text → clean token list", () => {
	it("splits on commas, semicolons and newlines, trimming whitespace", () => {
		expect(parseListInput("tools/call, tools/list;\nsend_email\n search_docs")).toEqual([
			"tools/call", "tools/list", "send_email", "search_docs",
		]);
	});

	it("drops empty entries and dedupes", () => {
		expect(parseListInput("a,, b , a\n\n;b")).toEqual(["a", "b"]);
	});

	it("returns [] for blank input", () => {
		expect(parseListInput("  \n,;")).toEqual([]);
	});
});

describe("isValidResource — mirrors validateResource for instant form feedback", () => {
	it("accepts exact HTTPS URIs", () => {
		expect(isValidResource("https://mcp.example.com/mcp")).toBe(true);
	});

	it("rejects plain HTTP, credentials, fragments and wildcards", () => {
		expect(isValidResource("http://mcp.example.com")).toBe(false);
		expect(isValidResource("https://user:pass@mcp.example.com")).toBe(false);
		expect(isValidResource("https://mcp.example.com/mcp#frag")).toBe(false);
		expect(isValidResource("https://mcp.example.com/*")).toBe(false);
		expect(isValidResource("not a url")).toBe(false);
	});
});

describe("buildAuthorizationDetail — one mcp_tool detail pinned to the resource", () => {
	it("builds a detail with locations locked to the resource and deduped lists", () => {
		expect(buildAuthorizationDetail("https://mcp.example.com/mcp", ["tools/call", "tools/call", "tools/list"], ["search", "search"])).toEqual({
			ok: true,
			detail: {
				type: "mcp_tool",
				locations: ["https://mcp.example.com/mcp"],
				actions: ["tools/call", "tools/list"],
				identifiers: ["search"],
			},
		});
	});

	it("rejects an invalid resource", () => {
		expect(buildAuthorizationDetail("http://x.example", ["a"], ["b"])).toEqual({ ok: false, error: "resource" });
	});

	it("rejects empty, oversized or >32-entry action/identifier lists", () => {
		expect(buildAuthorizationDetail("https://x.dev", [], ["b"]).ok).toBe(false);
		expect(buildAuthorizationDetail("https://x.dev", ["a"], []).ok).toBe(false);
		expect(buildAuthorizationDetail("https://x.dev", ["a".repeat(257)], ["b"]).ok).toBe(false);
		expect(buildAuthorizationDetail("https://x.dev", Array.from({ length: 33 }, (_, i) => `a${i}`), ["b"]).ok).toBe(false);
	});

	it("rejects wildcard entries", () => {
		expect(buildAuthorizationDetail("https://x.dev", ["a*"], ["b"]).ok).toBe(false);
		expect(buildAuthorizationDetail("https://x.dev", ["a"], ["to*ol"]).ok).toBe(false);
	});
});
