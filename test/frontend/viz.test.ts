import { describe, expect, it } from "vitest";
import {
	daySeries, isFirstRun, onboardingSteps, sparklineGeometry, toneMix, utcDay,
} from "../../frontend/src/viz";

describe("utcDay", () => {
	it("formats a millisecond epoch as the backend's UTC day key", () => {
		expect(utcDay(Date.UTC(2026, 8, 24, 23, 59))).toBe("2026-09-24");
		expect(utcDay(Date.UTC(2026, 0, 1))).toBe("2026-01-01");
	});
});

describe("daySeries", () => {
	it("fills the last N UTC days with zeros where the API has no rows", () => {
		const now = Date.UTC(2026, 8, 24, 15);
		const series = daySeries([{ day: "2026-09-23", count: 3 }], now, 7);
		expect(series.map(row => row.day)).toEqual([
			"2026-09-18", "2026-09-19", "2026-09-20", "2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24",
		]);
		expect(series.map(row => row.count)).toEqual([0, 0, 0, 0, 0, 3, 0]);
	});

	it("is ordered oldest → newest and ignores unknown day keys", () => {
		const now = Date.UTC(2026, 8, 24);
		const series = daySeries([
			{ day: "2026-09-24", count: 2 },
			{ day: "2026-09-17", count: 9 }, // outside the window
			{ day: "2026-09-20", count: 1 },
		], now, 7);
		expect(series.map(row => row.count)).toEqual([0, 0, 1, 0, 0, 0, 2]);
	});

	it("survives an empty usage payload", () => {
		expect(daySeries([], Date.UTC(2026, 8, 24), 7)).toHaveLength(7);
	});
});

describe("sparklineGeometry", () => {
	it("returns empty geometry for an empty series", () => {
		expect(sparklineGeometry([], 100, 30)).toEqual({ points: [], line: "", area: "" });
	});

	it("centers a single value and emits a bare M command", () => {
		const geo = sparklineGeometry([5], 100, 30, 2);
		expect(geo.points).toEqual([{ x: 50, y: 2 }]);
		expect(geo.line).toBe("M 50 2");
		expect(geo.area).toBe("");
	});

	it("maps the max to the top padding and zero to the baseline", () => {
		const geo = sparklineGeometry([0, 10], 100, 30, 2);
		expect(geo.points).toEqual([
			{ x: 2, y: 28 },
			{ x: 98, y: 2 },
		]);
		expect(geo.line).toBe("M 2 28 L 98 2");
		// area closes along the baseline back to the first point
		expect(geo.area).toBe("M 2 28 L 98 2 L 98 28 L 2 28 Z");
	});

	it("keeps an all-zero series flat on the baseline", () => {
		const geo = sparklineGeometry([0, 0, 0], 90, 30, 3);
		for (const point of geo.points) expect(point.y).toBe(27);
	});

	it("keeps every point inside the padded box", () => {
		const geo = sparklineGeometry([4, 1, 7, 0, 3, 9, 2], 120, 34, 3);
		for (const point of geo.points) {
			expect(point.x).toBeGreaterThanOrEqual(3);
			expect(point.x).toBeLessThanOrEqual(117);
			expect(point.y).toBeGreaterThanOrEqual(3);
			expect(point.y).toBeLessThanOrEqual(31);
		}
	});
});

describe("toneMix — recent audit rows grouped by resource tone", () => {
	const toneOf = (type: string) => ({ key: "apikey" } as Record<string, string>)[type] ?? type;

	it("counts per tone preserving first appearance order", () => {
		const rows = [
			{ resourceType: "agent" },
			{ resourceType: "agent" },
			{ resourceType: "key" },
			{ resourceType: "user" },
			{ resourceType: "agent" },
		];
		expect(toneMix(rows, toneOf)).toEqual([
			{ tone: "agent", count: 3 },
			{ tone: "apikey", count: 1 },
			{ tone: "user", count: 1 },
		]);
	});

	it("is empty for empty activity", () => {
		expect(toneMix([], toneOf)).toEqual([]);
	});
});

describe("onboardingSteps — first-run 3-step wizard state", () => {
	it("starts on step 1 when everything is zero", () => {
		const state = onboardingSteps({ applications: 0, agents: 0, exchanges: 0 });
		expect(state.complete).toBe(false);
		expect(state.next?.id).toBe("application");
		expect(state.steps.map(step => step.done)).toEqual([false, false, false]);
		expect(state.steps[0].current).toBe(true);
	});

	it("advances the current pointer as counts land", () => {
		expect(onboardingSteps({ applications: 2, agents: 0, exchanges: 0 }).next?.id).toBe("agent");
		expect(onboardingSteps({ applications: 2, agents: 1, exchanges: 0 }).next?.id).toBe("exchange");
		const done = onboardingSteps({ applications: 1, agents: 1, exchanges: 4 });
		expect(done.complete).toBe(true);
		expect(done.next).toBeNull();
		expect(done.steps.every(step => step.done)).toBe(true);
	});

	it("marks no step current once complete", () => {
		const state = onboardingSteps({ applications: 1, agents: 1, exchanges: 1 });
		expect(state.steps.some(step => step.current)).toBe(false);
	});
});

describe("isFirstRun — the guidance card gate", () => {
	it("is true only when every count and the exchange series are zero", () => {
		expect(isFirstRun({ applications: 0, agents: 0, delegations: 0, keys: 0, exchanges: 0 })).toBe(true);
		expect(isFirstRun({ applications: 1, agents: 0, delegations: 0, keys: 0, exchanges: 0 })).toBe(false);
		expect(isFirstRun({ applications: 0, agents: 0, delegations: 0, keys: 0, exchanges: 2 })).toBe(false);
	});
});
