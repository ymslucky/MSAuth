# MSAuth (openauth) — Development Guide

OpenAuth authentication server deployed on Cloudflare Workers (KV + D1 + Secrets Store).

## Development workflow (mandatory)

1. **TDD first**: for every feature or bug fix, write the failing tests first
   (red), then implement until they pass (green). Never write implementation
   before its test.
2. **Run the full suite before committing**:

   ```
   npm test          # vitest run — all tests must pass
   npm run check     # tsc + wrangler deploy --dry-run
   ```

3. **Commit automatically once tests pass.** Do not wait for the user to ask;
   a green suite is the commit signal. Keep commits focused on one change.

## Testing notes

- Integration tests run inside workerd via `@cloudflare/vitest-pool-workers`
  (vitest 4). Config lives in `vitest.config.mts`.
- Bindings are declared manually in `vitest.config.mts` (NOT via
  `wrangler.json`) so the Secrets Store bindings can be replaced with plain
  string mocks: `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`. Tests must never
  require live Cloudflare API access.
- D1 migrations in `migrations/` are applied in tests by
  `test/helpers.ts#applyMigrations` (imported with Vite `?raw`, split on
  semicolons, executed via `D1.batch`). When adding a migration, update the
  import list in `test/helpers.ts`.
- `SELF.fetch` defaults to `redirect: "follow"`; the auth flows under test
  depend on intermediate 302 responses and their `Set-Cookie` headers, so
  always pass `redirect: "manual"` and drive redirects explicitly.
- The password provider verification code is stored in KV under
  `debug:code:<email>` by `sendCode` (in `src/index.ts`) so tests can complete
  registration without an email provider.

## Architecture

- `src/index.ts` — Worker entry: OpenAuth issuer (password + GitHub providers),
  admin OAuth login flow (`/admin/login|callback|logout`), management API
  (`/api/users`, `/api/roles`, `/api/permissions`, `/api/me`).
- `src/admin.ts` — Admin console single-page app served at `/admin`. Keep this
  file free of backticks and `${}` (it is itself a template string).
- RBAC model: `role`, `permission`, `user_role`, `role_permission` tables.
  Permissions are enforced per-request from the DB; the issued subject JWT
  carries a `roles` claim. The first user to sign in is bootstrapped as admin.
- Secrets Store bindings (`SecretsStoreSecret`) resolve through
  `resolveGitHubCredentials`, which degrades gracefully when the store is
  unavailable so password login and the admin console keep working.