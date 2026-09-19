import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { createIssuer } from "../src/issuer";

describe("issuer caching", () => {
	it("reads Secrets Store credentials once within the TTL window", async () => {
		let githubIdCalls = 0;
		let githubSecretCalls = 0;
		const mockEnv = {
			...env,
			GITHUB_CLIENT_ID: {
				get: async () => {
					githubIdCalls++;
					return "test-id";
				},
			},
			GITHUB_CLIENT_SECRET: {
				get: async () => {
					githubSecretCalls++;
					return "test-secret";
				},
			},
		};

		await createIssuer(mockEnv);
		const afterFirst = githubIdCalls + githubSecretCalls;
		await createIssuer(mockEnv);
		const afterSecond = githubIdCalls + githubSecretCalls;

		expect(afterFirst).toBe(2);
		// Second build within the TTL must be served from cache.
		expect(afterSecond).toBe(afterFirst);
	});
});