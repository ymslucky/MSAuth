import { describe, expect, it } from "vitest";
import { fullTimestamp, isValidExpiry } from "../../frontend/src/api";

describe("isValidExpiry", () => {
	const now = Date.parse("2026-09-23T00:00:00.000Z");
	const MINUTE = 60_000;
	const DAY = 86_400_000;

	it("accepts values at least one minute ahead", () => {
		expect(isValidExpiry(new Date(now + MINUTE).toISOString(), now)).toBe(true);
		expect(isValidExpiry(new Date(now + MINUTE + 1_000).toISOString(), now)).toBe(true);
	});

	it("rejects values less than one minute ahead or in the past", () => {
		expect(isValidExpiry(new Date(now + MINUTE - 1_000).toISOString(), now)).toBe(false);
		expect(isValidExpiry(new Date(now - 1).toISOString(), now)).toBe(false);
	});

	it("accepts values up to exactly 30 days ahead", () => {
		expect(isValidExpiry(new Date(now + 30 * DAY).toISOString(), now)).toBe(true);
	});

	it("rejects values beyond 30 days", () => {
		expect(isValidExpiry(new Date(now + 30 * DAY + 1_000).toISOString(), now)).toBe(false);
	});

	it("rejects empty or unparseable input", () => {
		expect(isValidExpiry("", now)).toBe(false);
		expect(isValidExpiry("not-a-date", now)).toBe(false);
	});

	it("parses datetime-local values (no timezone suffix) as local time", () => {
		// Build "YYYY-MM-DDTHH:mm" from the LOCAL representation of now + 2 minutes.
		const stamp = new Date(now + 2 * MINUTE);
		const pad = (n: number) => String(n).padStart(2, "0");
		const local = `${stamp.getFullYear()}-${pad(stamp.getMonth() + 1)}-${pad(stamp.getDate())}T${pad(stamp.getHours())}:${pad(stamp.getMinutes())}`;
		expect(isValidExpiry(local, now)).toBe(true);
	});
});

describe("fullTimestamp", () => {
	it("returns a full ISO-8601 stamp for millisecond epochs", () => {
		expect(fullTimestamp(1758614400000)).toBe(new Date(1758614400000).toISOString());
	});

	it("returns a full ISO-8601 stamp for ISO strings", () => {
		expect(fullTimestamp("2026-09-30T10:30:37.000Z")).toBe("2026-09-30T10:30:37.000Z");
	});

	it("returns an empty string for missing or invalid values", () => {
		expect(fullTimestamp(undefined)).toBe("");
		expect(fullTimestamp(null)).toBe("");
		expect(fullTimestamp("")).toBe("");
		expect(fullTimestamp("nope")).toBe("");
	});
});
