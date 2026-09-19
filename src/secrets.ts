/**
 * A secret value is either a Secrets Store binding (production) or a plain
 * string (tests inject mocks so the real store is never required).
 */
type SecretSource = SecretsStoreSecret | string;

export function readSecret(source: SecretSource): Promise<string> {
	return typeof source === "string" ? Promise.resolve(source) : source.get();
}

// Secrets Store reads are remote and slow; cache for the isolate lifetime.
// Rotations take effect on the next deploy (which resets the isolate).
let credentialsCache: { value: Promise<[string, string]> } | null = null;
let allowlistCache: { value: string[] } | null = null;

export async function resolveGitHubCredentials(env: Env): Promise<[string, string]> {
	if (credentialsCache) return credentialsCache.value;
	const value = (async () => {
		try {
			return (await Promise.all([
				readSecret(env.GITHUB_CLIENT_ID),
				readSecret(env.GITHUB_CLIENT_SECRET),
			])) as [string, string];
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			if (message.toLowerCase().includes("secret")) {
				console.warn("GitHub secrets unavailable; GitHub login is disabled: " + message);
				return ["", ""] as [string, string];
			}
			throw e;
		}
	})();
	credentialsCache = { value };
	return value;
}

export async function getAdminAllowlist(env: Env): Promise<string[]> {
	if (allowlistCache) return allowlistCache.value;
	try {
		const raw = await readSecret(env.ADMIN_EMAIL);
		const value = raw
			.split(",")
			.map((entry) => entry.trim().toLowerCase())
			.filter(Boolean);
		allowlistCache = { value };
		return value;
	} catch (e) {
		console.warn("ADMIN_EMAIL unavailable; no users will be granted admin: " + (e instanceof Error ? e.message : String(e)));
		return [];
	}
}