import {
	CloudflareStorage,
	type CloudflareStorageOptions,
} from "@openauthjs/openauth/storage/cloudflare";

/**
 * Key prefixes whose values live in a memory cache. Only long-lived,
 * rarely-changing keys (the signing/encryption key pairs) are cached - this
 * lets the OpenAuth key loaders skip a slow KV list() on every request.
 * OAuth codes/refresh tokens etc. must never be cached.
 */
const CACHED_PREFIXES = [["signing:key"], ["encryption:key"]];

function isCachedKey(key: string[]): boolean {
	return CACHED_PREFIXES.some((prefix) =>
		prefix.every((part, i) => key[i] === part),
	);
}

/**
 * Wraps CloudflareStorage with a per-isolate memory cache for the key
 * material. Deployments reset the isolate, so a rotated/redeployed config
 * naturally takes effect without TTL bookkeeping.
 */
export function createStorage(env: Env) {
	const storage = CloudflareStorage({
		namespace: env.AUTH_STORAGE as CloudflareStorageOptions["namespace"],
	});

	const cache = new Map<string, unknown>();
	const keyOf = (key: string[]) => key.join(" ");
	const cachedScan = (prefix: string[]) => cache.has(keyOf([...prefix, ""]));

	return {
		...storage,
		async get(key: string[]): Promise<Record<string, any> | undefined> {
			if (isCachedKey(key) && cache.has(keyOf(key))) {
				return cache.get(keyOf(key)) as Record<string, any> | undefined;
			}
			return storage.get(key);
		},
		async set(key: string[], value: unknown, expiry?: Date): Promise<void> {
			await storage.set(key, value, expiry);
			if (isCachedKey(key)) cache.set(keyOf(key), value);
		},
		async remove(key: string[]) {
			await storage.remove(key);
			if (isCachedKey(key)) cache.delete(keyOf(key));
		},
		async *scan(prefix: string[]): AsyncGenerator<[string[], Record<string, any>], void, unknown> {
			if (isCachedKey(prefix) && cachedScan(prefix)) {
				const base = keyOf([...prefix, ""]);
				for (const [key, value] of cache) {
					if (key.startsWith(base)) yield [key, value] as unknown as [string[], Record<string, any>];
				}
				return;
			}
			for await (const [key, value] of storage.scan(prefix)) {
				if (isCachedKey(key)) cache.set(keyOf(key), value);
				yield [key, value] as unknown as [string[], Record<string, any>];
			}
		},
	};
}