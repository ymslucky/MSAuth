import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { applyMigrations } from "./helpers";
import { getOrCreateUser, getUserRoleNames } from "../src/users";

beforeAll(async () => {
	await applyMigrations();
});

describe("user provisioning (allowlist + registration gate)", () => {
	it("grants admin to allowlisted emails", async () => {
		const id = await getOrCreateUser(env, "root@example.com");
		const roles = await getUserRoleNames(env.AUTH_DB, id);
		expect(roles).toContain("admin");
		expect(roles).toContain("user");
	});

	it("matches the allowlist case-insensitively", async () => {
		const id = await getOrCreateUser(env, "owner@example.com");
		const roles = await getUserRoleNames(env.AUTH_DB, id);
		expect(roles).toContain("admin");
	});

	it("leaves non-allowlisted users as regular users", async () => {
		const id = await getOrCreateUser(env, "plain@example.com");
		const roles = await getUserRoleNames(env.AUTH_DB, id);
		expect(roles).toEqual(["user"]);
	});

	it("rejects new signups while registration is disabled", async () => {
		await env.AUTH_STORAGE.put("config:registration", "off");
		await expect(
			getOrCreateUser(env, "blocked@example.com"),
		).rejects.toThrow(/registration_disabled/);
		await env.AUTH_STORAGE.delete("config:registration");
	});

	
it("normalizes email casing on signup", async () => {
	const id = await getOrCreateUser(env, 'ROOT@Example.COM');
	const row = await env.AUTH_DB.prepare('SELECT email FROM user WHERE id = ?1').bind(id).first();
	expect(row?.email).toBe('root@example.com');
});

it("treats case variants as the same account", async () => {
	const a = await getOrCreateUser(env, 'dup@example.com');
	const b = await getOrCreateUser(env, 'DUP@Example.COM');
	expect(b).toBe(a);
	const count = await env.AUTH_DB.prepare('SELECT COUNT(*) AS n FROM user WHERE email = ?1').bind('dup@example.com').first();
	expect(count?.n).toBe(1);
});
it("still admits allowlisted users while registration is disabled", async () => {
		await env.AUTH_STORAGE.put("config:registration", "off");
		const id = await getOrCreateUser(env, "root@example.com");
		const roles = await getUserRoleNames(env.AUTH_DB, id);
		expect(roles).toContain("admin");
		await env.AUTH_STORAGE.delete("config:registration");
	});
});