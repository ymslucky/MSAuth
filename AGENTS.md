# MSAuth — Development Guide

IAM platform for individuals, indie hackers and one-person companies, with
native AI-Agent / MCP authorization. Deployed on Cloudflare Workers
(D1 + KV + Secrets Store). Stack: **Hono** (routing/middleware) +
**Better Auth** (auth engine + plugins). No legacy OpenAuth code.

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

## Architecture

```
src/platform.ts   Hono app — worker entry: security headers, rate limiting,
                  discovery endpoints, /api/auth/* (Better Auth handler),
                  /api/v1/* (management API), SPA fallback via ASSETS
src/iam/          auth.ts    Better Auth factory: plugins (admin, bearer, jwt,
                             passkey, twoFactor, organization, apiKey,
                             oauthProvider + exchange extension), per-request
                             secret resolution, admin allowlist
                  agents.ts  agent registry + delegation CRUD (/api/v1)
                  developers.ts  OAuth apps, API keys, resources, DCR review
                  governance.ts  overview, audit, users, sessions, alerts,
                                 platform settings, domain verification
                  http.ts    request helpers (body/text/list/page/audit)
                  types.ts   Bindings, Auth/Identity types, isOperator
src/agent/        exchange.ts  RFC 8693 token-exchange grant extension
                             (delegation chains, DPoP-bound, ≤5 min tokens)
                  policy.ts   RAR policy (mcp_tool details, subset-only
                             narrowing, HTTPS resource/redirect validation)
sdk/index.ts      Runtime-independent Agent SDK: AgentClient (PKCE +
                  DPoP authorize/complete/proof/fetch/refresh/exchange),
                  protected-resource metadata, authorizeToolCall
migrations/       0001_schema.sql (generated) + 0002_seed.sql (idempotent)
scripts/generate-schema.mjs   npm run db:schema — regenerates 0001 from the
                  Better Auth plugin schemas; run it after plugin changes
```

One responsibility per module, single-direction dependencies, no cycles.
Frontend SPA lives outside `src/` and is served by Workers Assets.

## Testing notes

- Integration tests run inside workerd via `@cloudflare/vitest-pool-workers`
  (vitest 4). Config: `vitest.config.mts`.
- Bindings are declared manually in `vitest.config.mts` (NOT via
  `wrangler.json`) so Secrets Store bindings become plain string mocks
  (`GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` / `ADMIN_EMAIL`). Tests must
  never require live Cloudflare API access.
- Migrations are applied in tests by importing `migrations/*.sql?raw`,
  stripping comments, splitting on `;` and running `D1.batch`.
- `SELF`-style flows use Hono's `app.request()`; auth state is a Better Auth
  session cookie obtained from `POST /api/auth/sign-in/email`.

## Deployment notes

- `BETTER_AUTH_URL` is a plain var in `wrangler.json` (set the real origin
  before deploying). `BETTER_AUTH_SECRET` is a Worker secret:
  `wrangler secret put BETTER_AUTH_SECRET` (≥ 32 chars).
- GitHub credentials + `ADMIN_EMAIL` resolve through Secrets Store bindings
  and degrade gracefully when absent.
- `predeploy` auto-creates the `msauth-db` D1 database if missing and applies
  migrations remotely. Old `openauth-db` data is NOT migrated; the new schema
  starts empty.

## Product invariants

- Admin identity: `ADMIN_EMAIL` (comma-separated, case-insensitive,
  email-verified) is the single source of truth, re-checked per request.
- Management API (`/api/v1/*`) accepts browser sessions only — Authorization
  and x-api-key headers are stripped before session lookup; mutations require
  same-origin.
- Agent tokens: exchanged via an explicit delegation, DPoP-bound to the
  registered agent key, audience-pinned to one HTTPS resource, lifetime
  ≤ 5 minutes, scopes/RAR may only narrow down the chain (depth ≤ 4).
- Every management mutation writes `auditEvent`; non-operators can only read
  their own audit rows.
