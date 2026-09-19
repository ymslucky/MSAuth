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

Modular layout under `src/` (keep it that way — one responsibility per
module, single-direction dependencies, no cycles):

- `index.ts` — worker entry: rate limiting + top-level routing only
- `http.ts` — pure HTTP helpers; `constants.ts` — shared constants
- `storage.ts` — KV adapter wrapper (TTL clamp); `subjects.ts` — subject schema
- `db/` — declarative schema management: `schema.sql` (desired structure,
  TS string module) + `seed.sql` + `ensure-schema.ts`. `ensureSchema(db)`
  runs once per cold start (structure -> column repairs -> seed) and
  self-heals missing tables/columns/seed rows; tests drive it through
  `applyMigrations()` in `test/helpers.ts`. Migrations 0001-0003 remain as
  historical record for already-provisioned databases; new schema changes
  ship by editing the declarative snapshot instead of adding migrations.
- `github.ts` — GitHub API client
- `secrets.ts` — secret reading (Secrets Store | string), ADMIN_EMAIL allowlist
- `sessions.ts` / `tokens.ts` — admin session lifecycle / JWT verification
- `users.ts` — user domain logic (signup, roles, last-admin protection)
- `authz.ts` — permission checks (hasPermission, permission codes)
- `audit.ts` — audit writer
- `issuer.ts` — OpenAuth issuer factory (allow whitelist, ttl, providers)
- `admin-flow.ts` — admin OAuth browser flow handlers
- `api/` — management API: `router.ts` (dispatch table + authz), one module
  per resource (`users.ts`, `roles.ts`, `permissions.ts`, `audit.ts`); each
  exports `register*Routes(): ApiRoute[]` — add endpoints by adding table
  entries, not by editing the dispatcher

- `src/index.ts` — Worker entry: OpenAuth issuer (password + GitHub providers),
  admin OAuth login flow (`/admin/login|callback|logout`), management API
  (`/api/users`, `/api/roles`, `/api/permissions`, `/api/me`).
- `src/admin.ts` — Admin console single-page app served at `/admin` via
  `renderAdminHtml(nonce)` (nonce-based CSP). Keep this file free of
  backticks; the only template interpolation is the server-generated nonce.
- RBAC model: `role`, `permission`, `user_role`, `role_permission` tables.
  Permissions are enforced per-request from the DB; the issued subject JWT
  carries a `roles` claim. The first user to sign in is bootstrapped as admin.
- Secrets Store bindings (`SecretsStoreSecret`) resolve through
  `readSecret`/`resolveGitHubCredentials`, which degrade gracefully when the
  store is unavailable so password login and the admin console keep working.
- Admin identity: `ADMIN_EMAIL` (comma-separated, case-insensitive) is the
  single source of truth for the admin role, re-asserted on every login.
  There is no first-user promotion.
- Admin sessions: the browser holds an opaque `__Host-admin_session` id
  backed by the `admin_sessions` D1 table (7 day absolute expiry, revocable
  by row delete on logout). Access tokens are 1 hour.
- `issuer({ allow })` whitelists only the admin-ui client and its exact
  redirect URI; template demo routes are removed.
- Brute force: /password/* POSTs are rate limited per IP via the
  RATE_LIMITER binding (60/60s).
- Registration: KV flag `config:registration` (default on). When off,
  logins that would create a new user are rejected; existing users and
  allowlisted admins keep working.
- Audit: every management mutation writes `audit_log`; read via
  `GET /api/audit` (audit:read permission).