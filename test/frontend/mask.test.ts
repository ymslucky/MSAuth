import { describe, expect, it } from "vitest";
import { maskId } from "../../frontend/src/api";

describe("maskId", () => {
	it("masks long opaque identifiers down to the first 8 characters + ellipsis", () => {
		expect(maskId("9f3c1a7e5b2d4c6a8f0e1d2c3b4a5f6e")).toBe("9f3c1a7e…");
	});

	it("returns short values unchanged (length ≤ keep + 4)", () => {
		expect(maskId("user_123")).toBe("user_123");
		expect(maskId("")).toBe("");
		expect(maskId("—")).toBe("—");
	});

	it("keeps values of exactly keep + 4 characters intact, masks keep + 5", () => {
		const atBoundary = "12345678abcd"; // 12 = keep(8) + 4
		expect(maskId(atBoundary)).toBe(atBoundary);
		expect(maskId(`${atBoundary}x`)).toBe("12345678…");
	});

	it("honours a custom keep width", () => {
		expect(maskId("msauth_ci_deadbeefcafebabe", 12)).toBe("msauth_ci_de…");
		expect(maskId("short_key", 12)).toBe("short_key"); // 9 ≤ 12 + 4
	});

	it("always leaves the value copyable through the caller (mask is display-only)", () => {
		const value = "sk_live_51H8xQ2eZvKYlo2C9k3mFt";
		expect(maskId(value)).not.toBe(value);
		expect(maskId(value).endsWith("…")).toBe(true);
		expect(value.startsWith(maskId(value).slice(0, -1))).toBe(true);
	});
});
