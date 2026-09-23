/** JSON fetch wrapper: same-origin cookies, uniform error surfacing. */
export async function api<T = Record<string, unknown>>(path: string, init?: RequestInit): Promise<T> {
	// Better Auth rejects body-less POSTs twice over — an empty JSON body is a
	// 400 and a missing content-type is a 415 — so JSON verbs default to `{}`.
	// `credentials` is DOM-spec; workerd's RequestInit omits it, so the literal is asserted.
	const method = (init?.method ?? "GET").toUpperCase();
	const jsonVerb = method === "POST" || method === "PATCH" || method === "PUT";
	const body = init?.body !== undefined && init?.body !== null ? init.body : jsonVerb ? "{}" : undefined;
	const requestInit = {
		credentials: "same-origin",
		...init,
		body,
		headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
	} as RequestInit;
	const response = await fetch(path, requestInit);
	const parsed = await response.json().catch(() => ({}));
	if (!response.ok) {
		const detail = parsed as { error?: string; message?: string; error_description?: string };
		throw new Error(detail.error_description ?? detail.message ?? detail.error ?? `HTTP ${response.status}`);
	}
	return parsed as T;
}

export const post = <T>(path: string, body?: unknown) => api<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) });
export const patch = <T>(path: string, body?: unknown) => api<T>(path, { method: "PATCH", body: JSON.stringify(body ?? {}) });
export const del = <T>(path: string) => api<T>(path, { method: "DELETE" });

/** The one failure-surfacing helper: Error → message, anything else → String. */
export function errorMessage(cause: unknown): string {
	return cause instanceof Error ? cause.message : String(cause);
}

export function fmtDate(value: number | string | undefined | null): string {
	// Platform tables store millisecond epochs; Better Auth tables return ISO-8601.
	if (value === undefined || value === null || value === "") return "—";
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

/**
 * Display mask for opaque identifiers/secrets: keep the first `keep`
 * characters, then an ellipsis. Short values (≤ keep + 4) pass through
 * untouched — masking only pays off once it hides something. The full
 * value stays reachable via the adjacent copy button / title attribute.
 */
export function maskId(value: string, keep = 8): string {
	return value.length <= keep + 4 ? value : `${value.slice(0, keep)}…`;
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
