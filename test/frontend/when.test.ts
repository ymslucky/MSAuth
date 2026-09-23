import { describe, expect, it } from "vitest";
import { formatWhen, WHEN_WINDOW_MS } from "../../frontend/src/when";

/** Fixed "now": 2026-09-24 12:00:00 local — epoch math stays timezone-agnostic. */
const NOW = Date.UTC(2026, 8, 24, 12, 0, 0);
const MIN = 60_000;
const HOUR = 3_600_000;

describe("formatWhen — relative under 24h, absolute beyond (one shared helper)", () => {
	it("renders empty/invalid values as an em dash", () => {
		expect(formatWhen(undefined, "zh", NOW)).toBe("—");
		expect(formatWhen(null, "zh", NOW)).toBe("—");
		expect(formatWhen("", "zh", NOW)).toBe("—");
		expect(formatWhen("not-a-date", "zh", NOW)).toBe("—");
	});

	it("just-now bucket covers anything under a minute (both directions)", () => {
		expect(formatWhen(NOW - 20_000, "zh", NOW)).toBe("刚刚");
		expect(formatWhen(NOW - 20_000, "en", NOW)).toBe("just now");
		expect(formatWhen(NOW + 30_000, "zh", NOW)).toBe("刚刚");
	});

	it("minutes bucket, localized", () => {
		expect(formatWhen(NOW - 3 * MIN, "zh", NOW)).toBe("3 分钟前");
		expect(formatWhen(NOW - 3 * MIN, "en", NOW)).toBe("3 min ago");
	});

	it("hours bucket, localized", () => {
		expect(formatWhen(NOW - 3 * HOUR, "zh", NOW)).toBe("3 小时前");
		expect(formatWhen(NOW - 3 * HOUR, "en", NOW)).toBe("3 h ago");
	});

	it("singular English hour reads naturally", () => {
		expect(formatWhen(NOW - HOUR, "en", NOW)).toBe("1 h ago");
	});

	it("beyond the 24h window falls back to the absolute locale string", () => {
		const beyond = NOW - WHEN_WINDOW_MS - MIN;
		expect(formatWhen(beyond, "zh", NOW)).toBe(new Date(beyond).toLocaleString());
		expect(formatWhen(beyond, "en", NOW)).toBe(new Date(beyond).toLocaleString());
	});

	it("at exactly the window edge it is still relative", () => {
		expect(formatWhen(NOW - WHEN_WINDOW_MS, "zh", NOW)).toBe("24 小时前");
	});
});
