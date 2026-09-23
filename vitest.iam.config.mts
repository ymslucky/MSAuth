import { defineConfig } from "vitest/config";
import { cloudflareTest } from "@cloudflare/vitest-pool-workers";

export default defineConfig({
  test: { include: ["test/iam/**/*.test.ts"], fileParallelism: false },
  plugins: [cloudflareTest({
    main: "./src/platform.ts",
    miniflare: {
      compatibilityDate: "2026-08-01",
      compatibilityFlags: ["nodejs_compat"],
      d1Databases: { AUTH_DB: "iam-test" },
      kvNamespaces: { AUTH_STORAGE: "iam-storage" },
      ratelimits: { RATE_LIMITER: { namespace_id: "1001", simple: { limit: 1000, period: 60 } } },
      bindings: {
        BETTER_AUTH_URL: "https://auth.example.com",
        BETTER_AUTH_SECRET: "test-only-secret-at-least-32-characters-long",
        GITHUB_CLIENT_ID: "test-client",
        GITHUB_CLIENT_SECRET: "test-secret",
        ADMIN_EMAIL: "root@example.com",
      },
    },
  })],
});
