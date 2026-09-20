import { env, SELF } from "cloudflare:test";
import { beforeAll, expect, it } from "vitest";
import { applyMigrations, api, CookieJar, createTestSession, ORIGIN } from "./helpers";

let admin: CookieJar;

beforeAll(async () => {
	await applyMigrations();
	admin = await createTestSession("root@example.com", ["admin", "user"]);
});

function bearer(token: string): Record<string, string> {
	return { authorization: "Bearer " + token };
}

it("creates an api key and returns the plaintext exactly once", async () => {
	const res = await api(admin, "/api/keys", {
		method: "POST",
		body: {
			name: "my agent",
			scopes: ["users:read"],
			expires_in_days: 30,
		},
	});
	expect(res.status).toBe(200);
	const data = (await res.json()) as { id: string; key: string; prefix: string };
	expect(data.key.startsWith("msa_")).toBe(true);
	expect(data.prefix.startsWith("msa_")).toBe(true);
	expect(data.key.includes(data.prefix.slice(4))).toBe(true);

	// The stored row must not contain the plaintext.
	const row = await env.AUTH_DB.prepare(
		"SELECT key_prefix FROM api_key WHERE id = ?1",
	)
		.bind(data.id)
		.first<{ key_prefix: string }>();
	expect(row?.key_prefix).toBe(data.prefix);
});

it("lists my keys without plaintext or hash", async () => {
	const res = await api(admin, "/api/keys");
	expect(res.status).toBe(200);
	const data = (await res.json()) as {
		keys: { name: string; key_prefix: string; key_hash?: string }[];
	};
	expect(data.keys.length).toBeGreaterThanOrEqual(1);
	for (const k of data.keys) {
		expect(k.key_hash).toBeUndefined();
	}
});

it("authenticates API requests with a Bearer key", async () => {
	const created = await api(admin, "/api/keys", {
		method: "POST",
		body: { name: 'bearer-test', scopes: ['users:read'] },
	});
	const { key } = (await created.json()) as { key: string };

	const res = await SELF.fetch(ORIGIN + "/api/users", {
		headers: bearer(key),
	});
	expect(res.status).toBe(200);
});

it("enforces key scopes", async () => {
	const created = await api(admin, "/api/keys", {
		method: "POST",
		body: { name: "readonly", scopes: ["users:read"] },
	});
	const { key } = (await created.json()) as { key: string };

	const res = await SELF.fetch(ORIGIN + "/api/roles", {
		headers: { authorization: "Bearer " + key },
	});
	expect(res.status).toBe(403);
});

it("rejects revoked keys", async () => {
	const created = await api(admin, "/api/keys", {
		method: "POST",
		body: { name: "doomed", scopes: ["users:read"] },
	});
	const { id, key } = (await created.json()) as { id: string; key: string };

	const del = await api(admin, "/api/keys/" + id, { method: "DELETE" });
	expect(del.status).toBe(200);

	const res = await SELF.fetch(ORIGIN + "/api/users", {
		headers: { authorization: "Bearer " + key },
	});
	expect(res.status).toBe(401);
});

it("rejects unknown keys", async () => {
	const res = await SELF.fetch(ORIGIN + "/api/users", {
		headers: { authorization: "Bearer msa_garbage" },
	});
	expect(res.status).toBe(401);
});

it("prevents escaling: cannot grant scopes I do not have", async () => {
	// member (plain user) has no management permissions - their key cannot
	// carry users:read either.
	const member = await createTestSession("keymember@example.com", ["user"]);
	const res = await api(member, "/api/keys", {
		method: "POST",
		body: { name: "sneaky", scopes: ["users:read"] },
	});
	expect(res.status).toBe(400);
});