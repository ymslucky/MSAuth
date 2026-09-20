import { SELF } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { applyMigrations, CookieJar, createTestSession, ORIGIN } from "./helpers";

beforeAll(async () => {
	await applyMigrations();
});

describe("favicon", () => {
	it("serves an SVG icon at /favicon.ico", async () => {
		const res = await SELF.fetch(ORIGIN + "/favicon.ico");
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("image/svg+xml");
		expect(res.headers.get("cache-control")).toContain("max-age");
		const body = await res.text();
		expect(body).toContain("<svg");
	});

	it("links the icon from the homepage", async () => {
		const res = await SELF.fetch(ORIGIN + "/");
		const html = await res.text();
		expect(html).toContain('rel="icon"');
		expect(html).toContain("data:image/svg+xml");
	});

	it("links the icon from the login page", async () => {
		const res = await SELF.fetch(ORIGIN + "/login");
		expect((await res.text())).toContain('rel="icon"');
	});

	it("links the icon from the console and account pages", async () => {
		const admin = await createTestSession("root@example.com", ["admin", "user"]);
		const member = await createTestSession("member@example.com", ["user"]);

		const consoleRes = await SELF.fetch(ORIGIN + "/admin", {
			headers: { cookie: admin.header() },
		});
		expect((await consoleRes.text())).toContain('rel="icon"');

		const meRes = await SELF.fetch(ORIGIN + "/me", {
			headers: { cookie: member.header() },
		});
		expect((await meRes.text())).toContain('rel="icon"');
	});
});