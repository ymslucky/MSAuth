import {
	CloudflareStorage,
	type CloudflareStorageOptions,
} from "@openauthjs/openauth/storage/cloudflare";

/**
 * Wraps CloudflareStorage so that expirations are clamped to the 60 second
 * KV minimum. The upstream adapter computes `floor((expiry - now) / 1000)`;
 * when request processing takes about a second, the 60 second authorization
 * code expiry turns into 59 and KV rejects the write, breaking code issuance.
 */
export function createStorage(env: Env) {
	const storage = CloudflareStorage({
		namespace: env.AUTH_STORAGE as CloudflareStorageOptions["namespace"],
	});
	return {
		...storage,
		async set(
			key: Parameters<typeof storage.set>[0],
			value: Parameters<typeof storage.set>[1],
			expiry?: Date,
		): Promise<void> {
			if (!expiry) return storage.set(key, value);
			const ttl = Math.floor((expiry.getTime() - Date.now()) / 1000);
			// Add headroom: the underlying adapter recomputes floor((expiry -
			// now) / 1000), which drops back below 60 without the buffer.
			await storage.set(
				key,
				value,
				new Date(Date.now() + Math.max(62, ttl + 2) * 1000),
			);
		},
	};
}