export type Gate = "login" | "consent" | "docs" | "console";

/** Single decision point for which view a path may render at a given auth state. */
export function resolveGate(path: string, authenticated: boolean): Gate {
	if (path === "/docs" || path.startsWith("/docs/")) return "docs";
	if (path === "/login") return "login";
	if (path === "/consent") return authenticated ? "consent" : "login";
	return authenticated ? "console" : "login";
}

const RETURN_TO_KEY = "msauth-returnto";

/**
 * Only same-origin absolute paths qualify as a post-login destination —
 * protocol-relative ("//host"), scheme-bearing and backslash forms are
 * rejected so a remembered link can never leave the site.
 */
export function safeReturnTo(value: string | null | undefined): string | null {
	if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
	return value;
}

/** Remembers the deep link that landed the visitor on the login view. */
export function rememberReturnTo(path: string, search: string): void {
	// /login is not a destination; /docs is public; /consent resumes through
	// the signed OAuth query instead of a remembered URL.
	if (path === "/login" || path === "/consent" || path === "/docs" || path.startsWith("/docs/")) return;
	const target = safeReturnTo(path + search);
	if (!target) return;
	try {
		sessionStorage.setItem(RETURN_TO_KEY, target);
	} catch {
		// storage unavailable (quota, privacy mode) — deep-link restore is best-effort
	}
}

/** Consumes the remembered deep link, if any; the value never survives a read. */
export function consumeReturnTo(): string | null {
	try {
		const value = safeReturnTo(sessionStorage.getItem(RETURN_TO_KEY));
		sessionStorage.removeItem(RETURN_TO_KEY);
		return value;
	} catch {
		return null;
	}
}
