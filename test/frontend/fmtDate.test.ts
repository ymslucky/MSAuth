import { describe, expect, it } from "vitest";
import { fmtDate } from "../../frontend/src/api";

describe("fmtDate", () => {
	it("formats millisecond epochs (platform-owned tables)", () => {
		expect(fmtDate(1758614400000)).not.toMatch(/Invalid/i);
	});

	it("formats ISO-8601 strings (Better Auth tables) instead of producing Invalid Date", () => {
		const formatted = fmtDate("2026-09-30T10:30:37.000Z");
		expect(formatted).not.toMatch(/Invalid/i);
		expect(formatted).not.toBe("—");
	});

	it("renders em dashes for missing values", () => {
		expect(fmtDate(undefined)).toBe("—");
		expect(fmtDate(null)).toBe("—");
	});

	it("degrades unparseable values to an em dash, never 'Invalid Date'", () => {
		expect(fmtDate("not-a-date")).toBe("—");
		expect(fmtDate("")).toBe("—");
		expect(fmtDate(Number.NaN)).toBe("—");
	});
});
