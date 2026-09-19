import { SELF } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import {
	applyMigrations,
	CookieJar,
	registerUserViaPassword,
	ORIGIN,
} from "./helpers";

beforeAll(async () => {
	await applyMigrations();
});

describe("admin authentication flow", () => {
	it("redirects /admin to /admin/login without a session", async () => {
		const res = await SELF.fetch(ORIGIN + "/admin", { redirect: "manual" });
		expect(res.status).toBe(302);
		expect(res.headers.get("location")).toBe(ORIGIN + "/admin/login");
	});

	it("starts an OAuth flow at /admin/login", async () => {
		const res = await SELF.fetch(ORIGIN + "/admin/login", { redirect: "manual" });
		expect(res.status).toBe(302);
		const location = new URL(res.headers.get("location")!);
		expect(location.pathname).toBe("/authorize");
		expect(location.searchParams.get("client_id")).toBe("admin-ui");
		expect(location.searchParams.get("response_type")).toBe("code");
		expect(location.searchParams.get("redirect_uri")).toBe(
			ORIGIN + "/admin/callback",
		);
		expect(location.searchParams.get("code_challenge_method")).toBe("S256");
		expect(location.searchParams.get("code_challenge")).toBeTruthy();
		expect(location.searchParams.get("state")).toBeTruthy();
		const setCookies = res.headers.getSetCookie?.() ?? [];
		expect(setCookies.some((c) => c.startsWith("admin_oauth="))).toBe(true);
	});

	it("rejects /admin/callback with a mismatched state", async () => {
		const res = await SELF.fetch(
			ORIGIN + "/admin/callback?code=x&state=attacker",
			{ redirect: "manual" },
		);
		expect(res.status).toBe(302);
		expect(res.headers.get("location")).toContain("/admin/login");
	});

	it("bootstraps the first registered user as admin", async () => {
		const jar = await registerUserViaPassword("admin@example.com", "password123");
		const meRes = await SELF.fetch(ORIGIN + "/api/me", {
			headers: { cookie: jar.header() },
		});
		expect(meRes.status).toBe(200);
		const me = (await meRes.json()) as {
			user: { email: string };
			roles: string[];
			permissions: string[];
		};
		expect(me.user.email).toBe("admin@example.com");
		expect(me.roles).toContain("admin");
		expect(me.roles).toContain("user");
		for (const permission of [
			"users:read",
			"users:write",
			"roles:read",
			"roles:write",
			"permissions:read",
			"permissions:write",
		]) {
			expect(me.permissions).toContain(permission);
		}
	});

	it("does not promote the second user and still serves the console page", async () => {
		const jar = await registerUserViaPassword("second@example.com", "password123");
		const meRes = await SELF.fetch(ORIGIN + "/api/me", {
			headers: { cookie: jar.header() },
		});
		const me = (await meRes.json()) as { roles: string[]; permissions: string[] };
		expect(me.roles).toEqual(["user"]);
		expect(me.permissions).toEqual([]);

		// The console page itself is served; the UI shows a "no access" screen.
		const pageRes = await SELF.fetch(ORIGIN + "/admin", {
			headers: { cookie: jar.header() },
		});
		expect(pageRes.status).toBe(200);
		expect(pageRes.headers.get("content-type")).toContain("text/html");
	});

	it("clears the session cookie on logout", async () => {
		const jar = await registerUserViaPassword("logout@example.com", "password123");
		const res = await SELF.fetch(ORIGIN + "/admin/logout", {
			headers: { cookie: jar.header() },
			redirect: "manual",
		});
		expect(res.status).toBe(302);
		const cleared = res.headers
			.getSetCookie?.()
			.some((c) => c.startsWith("admin_session=;"));
		expect(cleared).toBe(true);
	});
});