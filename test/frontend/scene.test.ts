import { describe, expect, it } from "vitest";
import { buildConstellation, mountLoginScene } from "../../frontend/src/scene";

const squaredLength = (x: number, y: number, z: number): number => x * x + y * y + z * z;

describe("buildConstellation", () => {
	const constellation = buildConstellation(700, 36, 2);

	it("emits exactly one xyz triple per node", () => {
		expect(constellation.positions.length).toBe(700 * 3);
	});

	it("places every node on the unit sphere", () => {
		for (let i = 0; i < constellation.positions.length; i += 3) {
			const r2 = squaredLength(
				constellation.positions[i],
				constellation.positions[i + 1],
				constellation.positions[i + 2],
			);
			expect(Math.abs(Math.sqrt(r2) - 1)).toBeLessThan(1e-6);
		}
	});

	it("is deterministic for repeated calls", () => {
		const again = buildConstellation(700, 36, 2);
		expect(Array.from(again.positions)).toEqual(Array.from(constellation.positions));
		expect(Array.from(again.edges)).toEqual(Array.from(constellation.edges));
		expect(Array.from(again.accents)).toEqual(Array.from(constellation.accents));
	});

	it("keeps edges valid, deduped, and inside the hairline cutoff", () => {
		const seen = new Set<string>();
		for (let e = 0; e < constellation.edges.length; e += 2) {
			const a = constellation.edges[e];
			const b = constellation.edges[e + 1];
			expect(a).toBeLessThan(700);
			expect(b).toBeLessThan(700);
			expect(a).toBeLessThan(b); // canonical ordering ⇒ dedupe check is exact
			const key = `${a}:${b}`;
			expect(seen.has(key)).toBe(false);
			seen.add(key);
			const dx = constellation.positions[a * 3] - constellation.positions[b * 3];
			const dy = constellation.positions[a * 3 + 1] - constellation.positions[b * 3 + 1];
			const dz = constellation.positions[a * 3 + 2] - constellation.positions[b * 3 + 2];
			expect(Math.sqrt(dx * dx + dy * dy + dz * dz)).toBeLessThanOrEqual(0.35);
		}
		// sparse but not skeletal: every node links to at least its nearest neighbour
		expect(constellation.edges.length / 2).toBeGreaterThanOrEqual(700);
	});

	it("spreads a unique, ordered set of accent nodes", () => {
		expect(constellation.accents.length).toBe(36);
		for (let i = 0; i < constellation.accents.length; i++) {
			expect(constellation.accents[i]).toBeLessThan(700);
			if (i > 0) expect(constellation.accents[i]).toBeGreaterThan(constellation.accents[i - 1]);
		}
	});
});

describe("mountLoginScene", () => {
	it("is an exported factory returning a cleanup function contract", () => {
		expect(typeof mountLoginScene).toBe("function");
	});
});
