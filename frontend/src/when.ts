/**
 * One shared timestamp formatter for every table/detail surface: relative
 * wording inside a 24-hour window ("3 小时前" / "3 h ago"), absolute locale
 * string beyond it (and for future timestamps, e.g. expiries). Pure and
 * framework-free — tested in test/frontend/when.test.ts; the React `<When>`
 * wrapper lives in ui.tsx.
 */
import type { Lang } from "./i18n";

const MINUTE = 60_000;
const HOUR = 3_600_000;

/** Relative wording applies within this window; older timestamps render absolute. */
export const WHEN_WINDOW_MS = 24 * HOUR;

export interface WhenLabels {
	justNow: string;
	minutesAgo: (n: number) => string;
	hoursAgo: (n: number) => string;
}

const LABELS: Record<Lang, WhenLabels> = {
	zh: {
		justNow: "刚刚",
		minutesAgo: n => `${n} 分钟前`,
		hoursAgo: n => `${n} 小时前`,
	},
	en: {
		justNow: "just now",
		minutesAgo: n => `${n} min ago`,
		hoursAgo: n => `${n} h ago`,
	},
};

export function formatWhen(value: number | string | undefined | null, lang: Lang, now: number = Date.now()): string {
	if (value === undefined || value === null || value === "") return "—";
	const time = new Date(value).getTime();
	if (Number.isNaN(time)) return "—";
	const delta = now - time;
	if (delta <= WHEN_WINDOW_MS && delta > -MINUTE) {
		const labels = LABELS[lang];
		if (delta < MINUTE) return labels.justNow;
		if (delta < HOUR) return labels.minutesAgo(Math.floor(delta / MINUTE));
		return labels.hoursAgo(Math.floor(delta / HOUR));
	}
	return new Date(time).toLocaleString();
}
