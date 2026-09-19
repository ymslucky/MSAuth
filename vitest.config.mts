import { defineConfig } from "vitest/config";
import { cloudflareTest } from "@cloudflare/vitest-pool-workers";

// Bindings are declared manually instead of reading wrangler.json so that the
// Secrets Store bindings (which require live Cloudflare API access) can be
// replaced with plain string mocks.
export default defineConfig({
	plugins: [
		cloudflareTest({
			main: "./src/index.ts",
			miniflare: {
				compatibilityDate: "2025-10-08",
				compatibilityFlags: ["nodejs_compat"],
				kvNamespaces: { AUTH_STORAGE: "auth-storage" },
				d1Databases: { AUTH_DB: "auth-db" },
				bindings: {
					GITHUB_CLIENT_ID: "test-client-id",
					GITHUB_CLIENT_SECRET: "test-client-secret",
				},
			},
		}),
	],
});