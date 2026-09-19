/**
 * A secret value is either a Secrets Store binding (production) or a plain
 * string (tests inject mocks so the real store is never required).
 */
type SecretSource = SecretsStoreSecret | string;

export function readSecret(source: SecretSource): Promise<string> {
	return typeof source === "string" ? Promise.resolve(source) : source.get();
}

let credentialsCache: {
	value: Promise<[string, string]>;
	expires: number;
} | null = null;
const CREDENTIALS_CACHE_TTL_MS = 10 * 60 * 1000;

let allowlistCache: { value: string[]; expires: number } | null = null;
const ALLOWLIST_CACHE_TTL_MS = 60 * 1000;

async function readWithFallback(fn: () => Promise<string>, warn: (m: string) => void): Promise<string> {
	try {
		return await fn();
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		if (message.toLowerCase().includes("secret")) {
			warn(message);
			return "";
		}
		throw e;
	}
}

export async function resolveGitHubCredentials(env: Env): Promise<[string, string]> {
	if (credentialsCache && Date.now() < credentialsCache.expires) {
		return credentialsCache.value;
	}
	const value = (async () => {
		return (await Promise.all([
			readSecret(env.GITHUB_CLIENT_ID),
			readSecret(env.GITHUB_CLIENT_SECRET),
		])) as [string, string];
	})().catch((e) => {
		const message = e instanceof Error ? e.message : String(e);
		if (message.toLowerCase().includes("secret")) {
			console.warn("GitHub secrets unavailable; GitHub login is disabled: " + message);
			return ["", ""] as [string, string];
		}
		throw e;
	});
	credentialsCache = { value, expires: Date.now() + CREDENTIALS_CACHE_TTL_MS };
	return value;
}

export async function getAdminAllowlist(env: Env): Promise<string[]> {
	if (allowlistCache && Date.now() < allowlistCache.expires) {
		return allowlistCache.value;
	}
	try {
		const raw = await readSecret(env.ADMIN_EMAIL);
		const value = raw
			.split(",")
			.map((entry) => entry.trim().toLowerCase())
			.filter(Boolean);
		allowlistCache = { value, expires: Date.now() + ALLOWLIST_CACHE_TTL_MS };
		return value;
	} catch (e) {
		console.warn("ADMIN_EMAIL unavailable; no users will be granted admin: " + (e instanceof Error ? e.message : String(e)));
		return [];
	}
}
