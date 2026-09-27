const SIG = "sig";
const PARAM_NAMES = "ba_param";
/** Provider-internal parameters that never travel back to /authorize. */
const INTERNAL = new Set([SIG, "exp", "ba_iat", PARAM_NAMES, "ba_pl"]);

/**
 * Mirrors @better-auth/oauth-provider's buildSignedOAuthQuery: reduces the
 * current page query to the signed parameters so the server can verify and
 * resume the pending OAuth request after sign-in or consent. `ba_param` is a
 * repeated parameter enumerating every signed name — read it with getAll().
 */
export function oauthQueryFromLocation(search: string): string | undefined {
	const params = new URLSearchParams(search);
	if (!params.has(SIG)) return undefined;
	const names = new Set(params.getAll(PARAM_NAMES));
	if (names.size === 0) return undefined;
	const signed = new URLSearchParams();
	for (const [key, value] of params.entries()) {
		if (key === SIG || key === PARAM_NAMES || names.has(key)) signed.append(key, value);
	}
	return signed.toString();
}

/**
 * The provider signs the login/consent query with the authorization-code
 * lifetime (60s here), and rejects expired signatures with invalid_signature —
 * so a query that cannot survive a submit round trip is already stale.
 */
export function oauthQueryExpired(search: string, now: number = Date.now()): boolean {
	const params = new URLSearchParams(search);
	if (!params.has(SIG)) return true;
	const exp = Number(params.get("exp"));
	if (!Number.isFinite(exp) || exp <= 0) return true;
	return exp * 1_000 < now + 10_000;
}

/**
 * Rebuilds the original /authorize request from a signed query by dropping
 * the internal parameters. /authorize re-validates the client and re-signs a
 * fresh query, which is the only way to recover from an expired signature.
 */
export function restartAuthorizePath(search: string): string | null {
	const params = new URLSearchParams(search);
	if (!params.has(SIG)) return null;
	const authorize = new URLSearchParams();
	for (const [key, value] of params.entries()) {
		if (!INTERNAL.has(key)) authorize.append(key, value);
	}
	return "/api/auth/oauth2/authorize?" + authorize.toString();
}
