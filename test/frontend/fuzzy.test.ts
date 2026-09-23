import { describe, expect, it } from "vitest";
import { fuzzyScore, searchRanked } from "../../frontend/src/palette";

describe("fuzzyScore — subsequence matching", () => {
	it("matches every character in order, case-insensitively", () => {
		expect(fuzzyScore("apl", "Applications")).not.toBeNull();
		expect(fuzzyScore("git", "GitHub")).not.toBeNull();
		expect(fuzzyScore("KEY", "api keys")).not.toBeNull();
	});

	it("rejects when a query character is missing", () => {
		expect(fuzzyScore("apz", "Applications")).toBeNull();
		expect(fuzzyScore("xyz", "Audit log")).toBeNull();
	});

	it("respects order — same set of letters in the wrong order fails", () => {
		expect(fuzzyScore("ca", "abc")).toBeNull(); // c comes after a
		expect(fuzzyScore("ac", "abc")).not.toBeNull();
	});

	it("an empty (or whitespace) query matches everything with score 0", () => {
		expect(fuzzyScore("", "Anything")).toBe(0);
		expect(fuzzyScore("   ", "Anything")).toBe(0);
	});
});

describe("fuzzyScore — ranking quality", () => {
	it("an exact match outranks a prefix, which outranks a scattered subsequence", () => {
		const exact = fuzzyScore("agents", "Agents")!;
		const prefix = fuzzyScore("agents", "Agents page")!;
		const scattered = fuzzyScore("agents", "a g e n t s")!;
		expect(exact).toBeGreaterThan(prefix);
		expect(prefix).toBeGreaterThan(scattered);
	});

	it("consecutive runs outrank gappy matches", () => {
		const consecutive = fuzzyScore("aud", "Audit log")!;
		const gappy = fuzzyScore("aud", "A-u-d")!;
		expect(consecutive).toBeGreaterThan(gappy);
	});

	it("a match at a word boundary outranks the same letters mid-word", () => {
		const boundary = fuzzyScore("log", "Audit log")!;
		const midWord = fuzzyScore("log", "bloginventory")!;
		expect(boundary).toBeGreaterThan(midWord);
	});

	it("shorter haystacks outrank long ones for the same match", () => {
		const short = fuzzyScore("key", "keys")!;
		const long = fuzzyScore("key", "keyboard shortcuts registry")!;
		expect(short).toBeGreaterThan(long);
	});

	it("scores are integers so they compose deterministically", () => {
		expect(Number.isInteger(fuzzyScore("api", "API keys"))).toBe(true);
	});
});

describe("searchRanked — filtering and ordering", () => {
	const items = [
		{ id: "audit", label: "Audit log" },
		{ id: "apps", label: "Applications" },
		{ id: "agents", label: "Agents" },
		{ id: "keys", label: "API keys" },
	];

	it("keeps only items whose label matches the query", () => {
		const results = searchRanked(items, "agent", item => item.label);
		expect(results.map(item => item.id)).toEqual(["agents"]);
	});

	it("an empty query returns every item in original order", () => {
		const results = searchRanked(items, "", item => item.label);
		expect(results).toEqual(items);
	});

	it("ranks stronger matches first — exact 'keys' beats 'key' inside another word", () => {
		const results = searchRanked(
			[
				{ id: "keys", label: "keys" },
				{ id: "other", label: "monkey wrench" },
			],
			"keys",
			item => item.label,
		);
		expect(results[0].id).toBe("keys");
	});

	it("ties keep the original order (stable ranking)", () => {
		const results = searchRanked(
			[
				{ id: "a", label: "Alpha item" },
				{ id: "b", label: "Alpha item" },
				{ id: "c", label: "Alpha item" },
			],
			"alpha",
			item => item.label,
		);
		expect(results.map(item => item.id)).toEqual(["a", "b", "c"]);
	});

	it("falls back to keywords when the label does not match, ranked below direct hits", () => {
		const results = searchRanked(
			[
				{ id: "audit", label: "Audit log", keywords: "security history" },
				{ id: "sec", label: "security" },
			],
			"security",
			item => item.label,
			item => item.keywords ?? "",
		);
		expect(results.map(item => item.id)).toEqual(["sec", "audit"]);
	});

	it("keywords can rescue items the label alone would filter out", () => {
		const results = searchRanked(
			[{ id: "audit", label: "Audit log", keywords: "security" }],
			"security",
			item => item.label,
			item => item.keywords ?? "",
		);
		expect(results).toHaveLength(1);
	});
});
