/** JSON fetch wrapper: same-origin cookies, uniform error surfacing. */
export async function api<T = Record<string, unknown>>(path: string, init?: RequestInit): Promise<T> {
	// Only declare JSON when a body exists — Better Auth 400s empty JSON bodies.
	// `credentials` is DOM-spec; workerd's RequestInit omits it, so the literal is asserted.
	const requestInit = {
		credentials: "same-origin",
		...init,
		headers: {
			...(init?.body !== undefined && init?.body !== null ? { "content-type": "application/json" } : {}),
			...(init?.headers ?? {}),
		},
	} as RequestInit;
	const response = await fetch(path, requestInit);
	const body = await response.json().catch(() => ({}));
	if (!response.ok) {
		const detail = body as { error?: string; message?: string; error_description?: string };
		throw new Error(detail.error_description ?? detail.message ?? detail.error ?? `HTTP ${response.status}`);
	}
	return body as T;
}

export const post = <T>(path: string, body?: unknown) => api<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) });
export const patch = <T>(path: string, body?: unknown) => api<T>(path, { method: "PATCH", body: JSON.stringify(body ?? {}) });
export const del = <T>(path: string) => api<T>(path, { method: "DELETE" });

export function fmtDate(value: number | string | undefined | null): string {
	// Platform tables store millisecond epochs; Better Auth tables return ISO-8601.
	if (value === undefined || value === null || value === "") return "—";
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

/** Full-precision ISO-8601 stamp for `<title>`/`<time>` attributes; "" when unparseable. */
export function fullTimestamp(value: number | string | undefined | null): string {
	if (value === undefined || value === null || value === "") return "";
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

/**
 * Mirrors the delegation rule: expiresAt must sit between one minute and
 * 30 days from now. Accepts ISO strings and datetime-local values (parsed
 * as local time by `new Date`).
 */
export function isValidExpiry(value: string, now: number = Date.now()): boolean {
	const time = new Date(value).getTime();
	if (Number.isNaN(time)) return false;
	return time >= now + 60_000 && time <= now + 30 * 86_400_000;
}

const DETAIL_SUMMARY_CAP = 240;

/**
 * Audit `detail` JSON → compact human-readable summary for table cells
 * ("key: value · key: value"). Non-JSON details pass through trimmed;
 * empty objects render as "" so cells fall back to an em dash.
 */
export function summarizeAuditDetail(detail: string): string {
	const trimmed = detail.trim();
	if (!trimmed || trimmed === "{}") return "";
	try {
		const parsed: unknown = JSON.parse(trimmed);
		if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return trimmed;
		const summary = Object.entries(parsed as Record<string, unknown>)
			.filter(([, value]) => value !== undefined && value !== null && value !== "")
			.map(([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`)
			.join(" · ");
		return summary.length > DETAIL_SUMMARY_CAP ? `${summary.slice(0, DETAIL_SUMMARY_CAP)}…` : summary;
	} catch {
		return trimmed.length > DETAIL_SUMMARY_CAP ? `${trimmed.slice(0, DETAIL_SUMMARY_CAP)}…` : trimmed;
	}
}
