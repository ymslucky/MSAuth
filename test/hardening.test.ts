import { SELF } from "cloudflare:test";
import { beforeAll, expect, it } from "vitest";
import {
	applyMigrations,
	CookieJar,
	registerUserViaPassword,
	ORIGIN,
} from "./helpers";

let admin: CookieJar;

beforeAll(async () => {
	await applyMigrations();
	admin = await registerUserViaPassword("root@example.com", "password123");
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
	const res = await SELF.fetch(
		ORIGIN + "/api/users?q=" + "a".repeat(201),
		{ headers: { cookie: admin.header() } },
	);
	expect(res.status).toBe(400);
});

it("returns generic error bodies from the issuer", async () => {
	// A valid login outside of an authorization flow raises
	// UnknownStateError inside the issuer; the response must not leak
	// internals.
	const res = await SELF.fetch(ORIGIN + "/password/authorize", {
		method: "POST",
		redirect: "manual",
		headers: { "content-type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({ email: "root@example.com", password: "password123" }),
	});
	expect(res.status).toBe(400);
	const body = await res.text();
	expect(body.toLowerCase()).not.toContain("unknown state");
	expect(body.toLowerCase()).not.toContain("cookie");
});