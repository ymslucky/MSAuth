/** JSON fetch wrapper: same-origin cookies, uniform error surfacing. */
export async function api<T = Record<string, unknown>>(path: string, init?: RequestInit): Promise<T> {
	const response = await fetch(path, {
		credentials: "same-origin",
		...init,
		headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
	});
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
	if (value === undefined || value === null) return "—";
	return new Date(Number(value)).toLocaleString();
}
