import { SELF } from "cloudflare:test";
import { beforeAll, expect, it } from "vitest";
import {
	applyMigrations,
	CookieJar,
	createTestSession,
	ORIGIN,
} from "./helpers";

let admin: CookieJar;

beforeAll(async () => {
	await applyMigrations();
	admin = await createTestSession("root@example.com", ["admin", "user"]);
});

it("serves the console with a nonce-based CSP", async () => {
	const res = await SELF.fetch(ORIGIN + "/admin", {
		headers: { cookie: admin.header() },
	});
	expect(res.status).toBe(200);
	const csp = res.headers.get("content-security-policy") ?? "";
	const nonceMatch = csp.match(/script-src 'nonce-([A-Za-z0-9_-]+)'/);
	expect(nonceMatch).toBeTruthy();
	const nonce = nonceMatch![1]!;
	const html = await res.text();
	expect(html).toContain(`nonce="${nonce}"`);
});

it("rejects overlong search queries with 400", async () => {
	const res = await SELF.fetch(ORIGIN + "/api/users?q=" + "a".repeat(201), {
		headers: { cookie: admin.header() },
	});
	expect(res.status).toBe(400);
});