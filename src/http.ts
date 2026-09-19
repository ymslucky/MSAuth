/** Small HTTP helpers shared by the worker routes. */

export function json(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "content-type": "application/json", "cache-control": "no-store" },
	});
}

export function redirect(
	location: URL | string,
	cookies: string[] = [],
): Response {
	const headers = new Headers({ location: location.toString() });
	for (const c of cookies) headers.append("set-cookie", c);
	return new Response(null, { status: 302, headers });
}

export function getCookie(request: Request, name: string): string | undefined {
	const header = request.headers.get("Cookie") ?? "";
	for (const part of header.split(/;\s*/)) {
		const eq = part.indexOf("=");
		if (eq > -1 && part.slice(0, eq).trim() === name) {
			return part.slice(eq + 1).trim();
		}
	}
	return undefined;
}

export function setCookieValue(
	name: string,
	value: string,
	maxAge: number,
): string {
	return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function randomToken(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	return base64UrlEncode(bytes);
}

export function base64UrlEncode(bytes: Uint8Array): string {
	let binary = "";
	for (const b of bytes) binary += String.fromCharCode(b);
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function intParam(
	url: URL,
	name: string,
	fallback: number,
	min: number,
	max?: number,
): number {
	const parsed = parseInt(url.searchParams.get(name) ?? "", 10);
	let value = Number.isNaN(parsed) ? fallback : parsed;
	value = Math.max(min, value);
	if (max !== undefined) value = Math.min(max, value);
	return value;
}

export async function readJson(request: Request): Promise<any> {
	try {
		return await request.json();
	} catch {
		return null;
	}
}

export function isUniqueError(e: unknown): boolean {
	const message = e instanceof Error ? e.message : String(e);
	return message.includes("UNIQUE");
}

export function splitCsv(value: string | null | undefined): string[] {
	return value ? value.split(",").filter(Boolean) : [];
}