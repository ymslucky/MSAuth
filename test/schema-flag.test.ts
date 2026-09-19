import { env } from "cloudflare:test";
import { beforeAll, expect, it } from "vitest";
import { ensureSchema, runEnsureSchema } from "../src/db/ensure-schema";
import { SCHEMA_VERSION } from "../src/db/ensure-schema";

beforeAll(async () => {
	await runEnsureSchema(env.AUTH_DB);
});

it("skips the reconcile when the schema version flag matches", async () => {
	await env.AUTH_STORAGE.put("config:schema-version", String(SCHEMA_VERSION));
	await env.AUTH_DB.exec("DROP TABLE audit_log");
	await ensureSchema(env.AUTH_DB, env.AUTH_STORAGE);
	const tables = await env.AUTH_DB.prepare(
		"SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'audit_log'",
	).all<{ name: string }>();
	expect(tables.results).toHaveLength(0);
});

it("reconciles when the version flag is absent", async () => {
	await env.AUTH_STORAGE.delete("config:schema-version");
	await env.AUTH_DB.exec("DROP TABLE IF EXISTS audit_log");
	await runEnsureSchema(env.AUTH_DB);
	const tables = await env.AUTH_DB.prepare(
		"SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'audit_log'",
	).all<{ name: string }>();
	expect(tables.results).toHaveLength(1);
});