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

	it("still admits allowlisted users while registration is disabled", async () => {
		await env.AUTH_STORAGE.put("config:registration", "off");
		const id = await getOrCreateUser(env, "root@example.com");
		const roles = await getUserRoleNames(env.AUTH_DB, id);
		expect(roles).toContain("admin");
		await env.AUTH_STORAGE.delete("config:registration");
	});
});