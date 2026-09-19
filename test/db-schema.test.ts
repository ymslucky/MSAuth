import { env, SELF } from "cloudflare:test";
import { beforeAll, expect, it } from "vitest";
import { runEnsureSchema } from "../src/db/ensure-schema";
import { ORIGIN } from "./helpers";

it("creates the full schema on demand", async () => {
	await runEnsureSchema(env.AUTH_DB);
	const tables = await env.AUTH_DB.prepare(
		"SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
	).all<{ name: string }>();
	const names = tables.results.map((t) => t.name);
	for (const table of [
		"user",
		"role",
		"permission",
		"user_role",
		"role_permission",
		"admin_sessions",
		"audit_log",
	]) {
		expect(names).toContain(table);
	}
});

it("is idempotent when run repeatedly", async () => {
	await runEnsureSchema(env.AUTH_DB);
	await expect(runEnsureSchema(env.AUTH_DB)).resolves.toBeUndefined();
});

it("repairs missing columns on existing tables", async () => {
	// Start from the full schema, then simulate an old database created
	// before the is_system column existed.
	await runEnsureSchema(env.AUTH_DB);
	await env.AUTH_DB.exec("ALTER TABLE role DROP COLUMN is_system");
	const before = await env.AUTH_DB.prepare("PRAGMA table_info(role)").all<{ name: string }>();
	expect(before.results.some((c) => c.name === "is_system")).toBe(false);

	await runEnsureSchema(env.AUTH_DB);

	const after = await env.AUTH_DB.prepare("PRAGMA table_info(role)").all<{ name: string }>();
	expect(after.results.some((c) => c.name === "is_system")).toBe(true);
	// The seed must also have re-marked built-in roles after the repair.
	const admin = await env.AUTH_DB
		.prepare("SELECT is_system FROM role WHERE name = 'admin'")
		.first<{ is_system: number }>();
	expect(admin?.is_system).toBe(1);
});

it("seeds built-in roles and permissions", async () => {
	await runEnsureSchema(env.AUTH_DB);
	const roles = await env.AUTH_DB.prepare("SELECT COUNT(*) AS n FROM role").first<{ n: number }>();
	const permissions = await env.AUTH_DB
		.prepare("SELECT COUNT(*) AS n FROM permission")
		.first<{ n: number }>();
	const grants = await env.AUTH_DB
		.prepare(
			`SELECT COUNT(*) AS n FROM role_permission rp
			JOIN role r ON r.id = rp.role_id WHERE r.name = 'admin'`,
		)
		.first<{ n: number }>();
	expect(roles?.n).toBeGreaterThanOrEqual(2);
	expect(permissions?.n).toBeGreaterThanOrEqual(8);
	expect(grants?.n).toBeGreaterThanOrEqual(8);
});

it("keeps the worker serving after ensureSchema runs on cold start", async () => {
	const res = await SELF.fetch(ORIGIN + "/api/audit", { redirect: "manual" });
	// 401 (no session) proves routing and DB access work post-bootstrap.
	expect(res.status).toBe(401);
});