/** Pure helpers for the unified notice stack (tested in test/frontend/notice.test.ts). */

export type NoticeTone = "success" | "error" | "info";

export const noticeTones: readonly NoticeTone[] = ["success", "error", "info"];

export const MAX_VISIBLE_TOASTS = 3;

/** Auto-dismiss lifetimes: success reads fast, errors linger, info sits between. */
export function noticeTtl(tone: NoticeTone): number {
	switch (tone) {
		case "success": return 3000;
		case "error": return 6000;
		case "info": return 4000;
	}
}

/** Keep the newest `max` toasts in an unbounded stack; older ones drop off. */
export function capVisibleToasts<T>(items: T[], max: number = MAX_VISIBLE_TOASTS): T[] {
	return items.length <= max ? items : items.slice(items.length - max);
}
