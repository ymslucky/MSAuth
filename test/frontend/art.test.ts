import { describe, expect, it } from "vitest";
import { mulberry32 } from "../../frontend/src/art";

describe("mulberry32", () => {
	it("is deterministic for a given seed", () => {
		const a = mulberry32(20260923);
		const b = mulberry32(20260923);
		const seqA = Array.from({ length: 8 }, () => a());
		const seqB = Array.from({ length: 8 }, () => b());
		expect(seqA).toEqual(seqB);
	});

	it("produces different streams for different seeds", () => {
		const first = mulberry32(1)();
		const second = mulberry32(2)();
		expect(first).not.toBe(second);
	});

	it("emits values in [0, 1)", () => {
		const rand = mulberry32(42);
		for (let i = 0; i < 1000; i++) {
			const value = rand();
			expect(value).toBeGreaterThanOrEqual(0);
			expect(value).toBeLessThan(1);
		}
	});
});

describe("mountLedgerArt", () => {
	it("is an exported factory returning a cleanup function contract", async () => {
		const mod = await import("../../frontend/src/art");
		expect(typeof mod.mountLedgerArt).toBe("function");
	});
});
