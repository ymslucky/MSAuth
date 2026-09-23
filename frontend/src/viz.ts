/**
 * Overview data visualization — pure geometry/state helpers (no DOM, no React).
 * Tested in test/frontend/viz.test.ts; the React surfaces live in
 * pages/console/Overview.tsx and consume these directly.
 *
 * API honesty: `/api/v1/overview` provides `usage` as a 7-day daily series of
 * `token.exchanged` counts (UTC-day buckets) — that is the only time series
 * the endpoint returns, so that is what the sparkline plots.
 */

export interface UsagePoint { day: string; count: number }

/** Millisecond epoch → the backend's `strftime('%Y-%m-%d', …,'unixepoch')` key. */
export function utcDay(ts: number): string {
	return new Date(ts).toISOString().slice(0, 10);
}

/**
 * Dense daily series over the last `days` UTC days ending today (missing
 * backend rows become 0), ordered oldest → newest. Out-of-window keys drop.
 */
export function daySeries(usage: readonly UsagePoint[], now: number, days: number): { day: string; count: number }[] {
	const byDay = new Map(usage.map(row => [row.day, row.count]));
	return Array.from({ length: days }, (_, index) => {
		const day = utcDay(now - (days - 1 - index) * 86_400_000);
		return { day, count: byDay.get(day) ?? 0 };
	});
}

const r2 = (value: number): number => Math.round(value * 100) / 100;

export interface SparklineGeometry {
	points: { x: number; y: number }[];
	/** Stroke path: "M x y L x y …" (a bare "M x y" for single-point series). */
	line: string;
	/** Closed fill path along the baseline; "" for single/empty series. */
	area: string;
}

/**
 * Inline-SVG sparkline geometry. Max value maps to the top padding, zero to
 * the baseline; the scale floor is 1 so an all-zero series stays on the
 * baseline instead of dividing by zero.
 */
export function sparklineGeometry(values: readonly number[], width: number, height: number, pad = 2): SparklineGeometry {
	if (values.length === 0) return { points: [], line: "", area: "" };
	const max = Math.max(1, ...values);
	const innerWidth = width - pad * 2;
	const innerHeight = height - pad * 2;
	const points = values.map((value, index) => ({
		x: r2(values.length === 1 ? width / 2 : pad + (index * innerWidth) / (values.length - 1)),
		y: r2(height - pad - (value / max) * innerHeight),
	}));
	const line = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
	const area = points.length < 2
		? ""
		: `${line} L ${points[points.length - 1].x} ${r2(height - pad)} L ${points[0].x} ${r2(height - pad)} Z`;
	return { points, line, area };
}

/**
 * Group recent audit rows by resource tone (the ResourceTag vocabulary), in
 * first-appearance order. `toneOf` is injected so this module stays decoupled
 * from the React component tree.
 */
export function toneMix<T extends { resourceType: string }>(
	rows: readonly T[],
	toneOf: (type: string) => string,
): { tone: string; count: number }[] {
	const mix: { tone: string; count: number }[] = [];
	const index = new Map<string, number>();
	for (const row of rows) {
		const tone = toneOf(row.resourceType);
		const at = index.get(tone);
		if (at === undefined) {
			index.set(tone, mix.length);
			mix.push({ tone, count: 1 });
		} else {
			mix[at].count += 1;
		}
	}
	return mix;
}

/* ---------- first-run wizard state ---------- */

export type OnboardingStepId = "application" | "agent" | "exchange";

export interface OnboardingStep {
	id: OnboardingStepId;
	done: boolean;
	/** Exactly one step is current while the journey is incomplete. */
	current: boolean;
}

/**
 * 创建应用 → 注册代理 → 交换第一个令牌. Step N is done once its artifact
 * exists; the first un-done step is current; everything done = complete.
 */
export function onboardingSteps(state: { applications: number; agents: number; exchanges: number }): {
	steps: OnboardingStep[];
	next: OnboardingStep | null;
	complete: boolean;
} {
	const doneFlags = [
		state.applications > 0,
		state.agents > 0,
		state.exchanges > 0,
	];
	const ids: OnboardingStepId[] = ["application", "agent", "exchange"];
	// current = the first not-done step; none once complete.
	const firstOpen = doneFlags.indexOf(false);
	const steps = ids.map((id, index) => ({
		id,
		done: doneFlags[index],
		current: index === firstOpen,
	}));
	const complete = firstOpen === -1;
	return { steps, next: complete ? null : steps[firstOpen], complete };
}

/** True when the console has nothing at all yet — the first-run gate. */
export function isFirstRun(state: {
	applications: number; agents: number; delegations: number; keys: number; exchanges: number;
}): boolean {
	return state.applications === 0 && state.agents === 0 && state.delegations === 0
		&& state.keys === 0 && state.exchanges === 0;
}
