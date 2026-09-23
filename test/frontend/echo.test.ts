import { describe, expect, it } from "vitest";
import { projectSphere } from "../../frontend/src/echo";

const SIZE = 220;

describe("projectSphere — consent echo projection", () => {
	const points = projectSphere(180, 12, SIZE);

	it("emits one point per requested node", () => {
		expect(points).toHaveLength(180);
	});

	it("is deterministic for a given seed", () => {
		expect(projectSphere(180, 12, SIZE)).toEqual(points);
	});

	it("keeps every point inside the canvas with a small margin", () => {
		for (const point of points) {
			expect(point.x).toBeGreaterThanOrEqual(4);
			expect(point.x).toBeLessThanOrEqual(SIZE - 4);
			expect(point.y).toBeGreaterThanOrEqual(4);
			expect(point.y).toBeLessThanOrEqual(SIZE - 4);
		}
	});

	it("spreads exactly `accents` vermilion nodes, ascending by index", () => {
		const accents = points.map((point, index) => (point.accent ? index : -1)).filter(index => index >= 0);
		expect(accents).toHaveLength(12);
		for (let i = 1; i < accents.length; i++) expect(accents[i]).toBeGreaterThan(accents[i - 1]);
	});

	it("re-projects to a different size without losing the pattern", () => {
		const small = projectSphere(180, 12, 110);
		expect(small).toHaveLength(180);
		for (const point of small) {
			expect(point.x).toBeLessThanOrEqual(110);
			expect(point.y).toBeLessThanOrEqual(110);
		}
	});
});
