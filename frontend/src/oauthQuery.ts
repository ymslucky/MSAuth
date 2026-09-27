const SIG = "sig";
const PARAM_NAMES = "ba_param";

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
