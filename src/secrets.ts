/**
 * A secret value is either a Secrets Store binding (production) or a plain
 * string (tests inject mocks so the real store is never required).
 */
type SecretSource = SecretsStoreSecret | string;

export function readSecret(source: SecretSource): Promise<string> {
	return typeof source === "string" ? Promise.resolve(source) : source.get();
}

/**
 * Resolves the GitHub credentials. When the Secrets Store is unavailable
 * (e.g. local/integration test environments), degrade to a disabled GitHub
 * provider instead of failing every request; password login and the admin
 * console keep working.
 */
export async function resolveGitHubCredentials(
	env: Env,
): Promise<[string, string]> {
	try {
		return await Promise.all([
			readSecret(env.GITHUB_CLIENT_ID),
			readSecret(env.GITHUB_CLIENT_SECRET),
		]);
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		if (message.toLowerCase().includes("secret")) {
			console.warn(
				"GitHub secrets unavailable; GitHub login is disabled: " + message,
			);
			return ["", ""];
		}
		throw e;
	}
}

/**
 * Reads the admin email allowlist from the ADMIN_EMAIL binding (comma
 * separated). An unavailable or empty list means nobody is granted admin.
 */
export async function getAdminAllowlist(env: Env): Promise<string[]> {
	try {
		const raw = await readSecret(env.ADMIN_EMAIL);
		return raw
			.split(",")
			.map((entry) => entry.trim().toLowerCase())
			.filter(Boolean);
	} catch (e) {
		console.warn(
			"ADMIN_EMAIL unavailable; no users will be granted admin: " +
				(e instanceof Error ? e.message : String(e)),
		);
		return [];
	}
}