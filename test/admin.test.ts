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
		expect(setCookies.some((c) => c.startsWith("__Host-admin_oauth="))).toBe(true);
	});

	it("rejects /admin/callback with a mismatched state", async () => {
		const res = await SELF.fetch(
			ORIGIN + "/admin/callback?code=x&state=attacker",
			{ redirect: "manual" },
		);
		expect(res.status).toBe(302);
		expect(res.headers.get("location")).toContain("/admin/login");
	});

	it("promotes allowlisted emails to admin on login", async () => {
		const jar = await registerUserViaPassword("root@example.com", "password123");
		const meRes = await SELF.fetch(ORIGIN + "/api/me", {
			headers: { cookie: jar.header() },
		});
		expect(meRes.status).toBe(200);
		const me = (await meRes.json()) as {
			user: { email: string };
			roles: string[];
			permissions: string[];
		};
		expect(me.user.email).toBe("root@example.com");
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

	it("matches the admin allowlist case-insensitively", async () => {
		const jar = await registerUserViaPassword("owner@example.com", "password123");
		const meRes = await SELF.fetch(ORIGIN + "/api/me", {
			headers: { cookie: jar.header() },
		});
		const me = (await meRes.json()) as { roles: string[] };
		expect(me.roles).toContain("admin");
	});

	it("does not promote non-allowlisted users and still serves the console page", async () => {
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

	it("rejects unknown client ids at /authorize", async () => {
		const url =
			ORIGIN +
			"/authorize?" +
			new URLSearchParams({
				client_id: "evil-app",
				redirect_uri: ORIGIN + "/admin/callback",
				response_type: "code",
				state: "x",
			});
		const res = await SELF.fetch(url, { redirect: "manual" });
		expect(res.status).toBe(302);
		const location = res.headers.get("location")!;
		expect(location).toContain("error=unauthorized_client");
	});

	it("rejects unknown redirect uris at /authorize", async () => {
		const url =
			ORIGIN +
			"/authorize?" +
			new URLSearchParams({
				client_id: "admin-ui",
				redirect_uri: ORIGIN + "/evil",
				response_type: "code",
				state: "x",
			});
		const res = await SELF.fetch(url, { redirect: "manual" });
		expect(res.status).toBe(302);
		expect(res.headers.get("location")).toContain("error=unauthorized_client");
	});

	it("returns 404 for the removed demo routes", async () => {
		const root = await SELF.fetch(ORIGIN + "/", { redirect: "manual" });
		expect(root.status).toBe(404);
		const callback = await SELF.fetch(ORIGIN + "/callback", { redirect: "manual" });
		expect(callback.status).toBe(404);
	});

	it("issues an opaque server-side session cookie, not a JWT", async () => {
		const jar = await registerUserViaPassword("opaque@example.com", "password123");
		const cookie = jar.header();
		// JWTs contain two dots (header.payload.signature); session ids do not.
		expect(cookie).toContain("__Host-admin_session=");
		const value = cookie.split("__Host-admin_session=")[1] ?? "";
		expect(value).not.toContain(".");
		expect(value.length).toBeGreaterThan(30);
	});

	it("revokes the session server-side on logout", async () => {
		const jar = await registerUserViaPassword("revoke@example.com", "password123");
		// Session works before logout.
		const before = await SELF.fetch(ORIGIN + "/api/me", {
			headers: { cookie: jar.header() },
		});
		expect(before.status).toBe(200);

		// Simulate a stolen cookie: replay it after logout.
		const stolen = jar.header();
		await SELF.fetch(ORIGIN + "/admin/logout", {
			headers: { cookie: jar.header() },
			redirect: "manual",
		});
		const after = await SELF.fetch(ORIGIN + "/api/me", {
			headers: { cookie: stolen },
		});
		expect(after.status).toBe(401);
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
			.some((c) => c.startsWith("__Host-admin_session=;"));
		expect(cleared).toBe(true);
	});
});