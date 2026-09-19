import { createLocalJWKSet, jwtVerify } from "jose";
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

export async function verifyAccessToken(
	env: Env,
	token: string,
): Promise<AccessTokenPayload> {
	const storage = CloudflareStorage({
		namespace: env.AUTH_STORAGE,
	});
	const keys = await signingKeys(storage);
	const jwks = createLocalJWKSet({
		keys: keys.map((k) => ({ ...k.jwk, alg: k.alg, use: "sig" })),
	});
	const { payload } = await jwtVerify(token, jwks);
	return payload as unknown as AccessTokenPayload;
}