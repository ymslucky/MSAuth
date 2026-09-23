import { describe, expect, it } from "vitest";
import { summarizeAuditDetail } from "../../frontend/src/api";

describe("summarizeAuditDetail", () => {
	it("renders empty output for empty objects", () => {
		expect(summarizeAuditDetail("{}")).toBe("");
		expect(summarizeAuditDetail("")).toBe("");
	});

	it("flattens a flat JSON object into a compact key: value summary", () => {
		expect(summarizeAuditDetail('{"reason":"spam","scope":"mcp:invoke"}')).toBe("reason: spam · scope: mcp:invoke");
	});

	it("stringifies non-string values compactly", () => {
		expect(summarizeAuditDetail('{"depth":2,"flags":[1,2],"nested":{"a":true}}')).toBe(
			"depth: 2 · flags: [1,2] · nested: {\"a\":true}",
		);
	});

	it("skips null, undefined and empty-string entries", () => {
		expect(summarizeAuditDetail('{"a":null,"b":"","c":"kept"}')).toBe("c: kept");
	});

	it("passes through non-JSON details trimmed", () => {
		expect(summarizeAuditDetail("  plain text detail  ")).toBe("plain text detail");
	});

	it("passes through JSON arrays verbatim", () => {
		expect(summarizeAuditDetail('["x"]')).toBe('["x"]');
	});

	it("caps very long summaries with an ellipsis", () => {
		const detail = JSON.stringify({ reason: "x".repeat(400) });
		const summary = summarizeAuditDetail(detail);
		expect(summary.length).toBeLessThanOrEqual(241);
		expect(summary.endsWith("…")).toBe(true);
	});
});
