import { createLocalJWKSet, jwtVerify, decodeJwt } from "jose";
import { signingKeys } from "@openauthjs/openauth/keys";
import { CloudflareStorage } from "@openauthjs/openauth/storage/cloudflare";

export interface AccessTokenPayload {
	mode: string;
	type: string;
	sub: string;
	aud: string;
	iss: string;
	properties: {
		id: string;
		roles: string[];
	};
}

// Importing RSA/EC keys from KV on every request is expensive; cache the
// imported key set for the lifetime of the isolate (deploys reset it).
let jwksCache: { jwks: ReturnType<typeof createLocalJWKSet> } | null = null;

async function getJwks(env: Env) {
	if (jwksCache) return jwksCache.jwks;
	const storage = CloudflareStorage({ namespace: env.AUTH_STORAGE });
	const keys = await signingKeys(storage);
	const jwks = createLocalJWKSet({
		keys: keys.map((k) => ({ ...k.jwk, alg: k.alg, use: "sig" })),
	});
	jwksCache = { jwks };
	return jwks;
}

export async function verifyAccessToken(env: Env, token: string): Promise<AccessTokenPayload> {
	const jwks = await getJwks(env);
	const { payload } = await jwtVerify(token, jwks);
	return payload as unknown as AccessTokenPayload;
}

/**
 * Decodes the payload WITHOUT signature verification. Only safe for tokens
 * that never left this process (e.g. issued moments ago by /token and read
 * back inside the same request chain).
 */
export function decodeAccessTokenPayload(token: string): AccessTokenPayload | null {
	try {
		const payload = decodeJwt(token);
		return payload as unknown as AccessTokenPayload;
	} catch {
		return null;
	}
}