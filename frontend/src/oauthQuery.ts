const SIG = "sig";
const PARAM_NAMES = "ba_param";

/**
 * Mirrors @better-auth/oauth-provider's client plugin: reduces the current
 * page query to the signed parameters so the server can verify and resume
 * the pending OAuth request after sign-in or consent.
 */
export function oauthQueryFromLocation(search: string): string | undefined {
	const params = new URLSearchParams(search);
	if (!params.has(SIG)) return undefined;
	const names = (params.get(PARAM_NAMES) ?? "").split(",").filter(Boolean);
	const signed = new URLSearchParams();
	for (const [key, value] of params.entries()) {
		if (key === SIG || key === PARAM_NAMES || names.includes(key)) signed.append(key, value);
	}
	return signed.toString();
}
