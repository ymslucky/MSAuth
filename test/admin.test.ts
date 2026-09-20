import { env, SELF } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import {
	applyMigrations,
	postLoginDestination,
	api,
	CookieJar,
	createTestSession,
	ORIGIN,
} from "./helpers";


let admin: CookieJar;
let member: CookieJar;

beforeAll(async () => {
	await applyMigrations();
	admin = await createTestSession("root@example.com", ["admin", "user"]);
	member = await createTestSession("member@example.com", ["user"]);
});

describe("unified /login entry", () => {
	it("redirects /admin to /login without a session", async () => {
		const res = await SELF.fetch(ORIGIN + "/admin", { redirect: "manual" });
		expect(res.status).toBe(302);
		expect(res.headers.get("location")).toBe(ORIGIN + "/login");
	});

	it("redirects /me to /login without a session", async () => {
		const res = await SELF.fetch(ORIGIN + "/me", { redirect: "manual" });
		expect(res.status).toBe(302);
		expect(res.headers.get("location")).toContain("/login");
	});

	it("redirects legacy /admin/login to /login", async () => {
		const res = await SELF.fetch(ORIGIN + "/admin/login", { redirect: "manual" });
		expect(res.status).toBe(302);
		expect(res.headers.get("location")).toBe(ORIGIN + "/login");
	});

	it("serves the hand-drawn login page at /login", async () => {
		const res = await SELF.fetch(ORIGIN + "/login", { redirect: "manual" });
		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).toContain("登录 MSAuth");
		expect(html).toContain("/login/start");
		expect(html).toContain("返回主页");
		// GitHub-only sign-in: no password form.
		expect(html).not.toContain("type=\"password\"");
		// favicon data: URI must be allowed by the login CSP
		const loginCsp = res.headers.get("content-security-policy") ?? "";
		expect(loginCsp).toContain("img-src 'self' data:");
	});

	it("shows an error notice on /login after a failed flow", async () => {
		const res = await SELF.fetch(ORIGIN + "/login?error=invalid_state", {
			redirect: "manual",
		});
		expect(res.status).toBe(200);
		expect(await res.text()).toContain("登录失败");
	});
});

describe("/login/start (GitHub OAuth entry)", () => {
	it("redirects straight to GitHub with a one-time msa_ state", async () => {
		const res = await SELF.fetch(ORIGIN + "/login/start", { redirect: "manual" });
		expect(res.status).toBe(302);
		const location = new URL(res.headers.get("location")!);
		expect(location.hostname).toBe("github.com");
		expect(location.pathname).toBe("/login/oauth/authorize");
		expect(location.searchParams.get("client_id")).toBe("test-client-id");
		expect(location.searchParams.get("redirect_uri")).toBe(
			ORIGIN + "/github/callback",
		);
		expect(location.searchParams.get("scope")).toBe("user:email");
		const state = location.searchParams.get("state")!;
		expect(state.startsWith("msa_")).toBe(true);
		// One-time login state is persisted for the callback to verify.
		const stored = await env.AUTH_STORAGE.get("login:" + state);
		expect(stored).toBe("1");
	});

	it("does NOT emit any internal issuer state cookies", async () => {
		const res = await SELF.fetch(ORIGIN + "/login/start", { redirect: "manual" });
		const setCookies = res.headers.getSetCookie?.() ?? [];
		expect(setCookies.some((c) => c.startsWith("authorization="))).toBe(false);
		expect(setCookies.some((c) => c.startsWith("provider="))).toBe(false);
	});
});

describe("/login/github callback guard rails", () => {
	it("rejects unknown state", async () => {
		const res = await SELF.fetch(
			ORIGIN + "/login/github?code=x&state=msa_unknown",
			{ redirect: "manual" },
		);
		expect(res.status).toBe(302);
		expect(res.headers.get("location")).toContain("error=invalid_state");
	});

	it("rejects missing state", async () => {
		const res = await SELF.fetch(ORIGIN + "/login/github?code=x", {
			redirect: "manual",
		});
		expect(res.status).toBe(302);
		expect(res.headers.get("location")).toContain("error=invalid_state");
	});
});

describe("management console", () => {
	it("serves the workbench for admins", async () => {
		const res = await SELF.fetch(ORIGIN + "/admin", {
			headers: { cookie: admin.header() },
		});
		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).toContain("<aside");
		expect(html).not.toContain("onclick=");
	});

	it("serves regular users the access-denied screen", async () => {
		const res = await SELF.fetch(ORIGIN + "/admin", {
			headers: { cookie: member.header() },
		});
		expect(res.status).toBe(200);
		expect(await res.text()).toContain("没有访问权限");
	});

	it("allows data: images in the /me CSP", async () => {
		const res = await SELF.fetch(ORIGIN + "/me", {
			headers: { cookie: member.header() },
		});
		const csp = res.headers.get("content-security-policy") ?? "";
		expect(csp).toContain("img-src 'self' data:");
	});

	it("allows data: images in the console CSP (favicon)", async () => {
		const res = await SELF.fetch(ORIGIN + "/admin", {
			headers: { cookie: member.header() },
		});
		const csp = res.headers.get("content-security-policy") ?? "";
		expect(csp).toContain("img-src https: data:");
	});

	it("clears the session cookie on logout", async () => {
		const disposable = await createTestSession("disposable@example.com", ["user"]);
		const res = await SELF.fetch(ORIGIN + "/admin/logout", {
		headers: { cookie: disposable.header() },
			redirect: "manual",
		});
		expect(res.status).toBe(302);
		const cleared = res.headers
			.getSetCookie?.()
			.some((c) => c.startsWith("__Host-admin_session=;"));
		expect(cleared).toBe(true);
	});
});

describe("management API authorization", () => {
	it("rejects unauthenticated requests", async () => {
		const res = await SELF.fetch(ORIGIN + "/api/users", { redirect: "manual" });
		expect(res.status).toBe(401);
	});

	it("rejects requests from users without the required permission", async () => {
		const res = await api(member, "/api/users");
		expect(res.status).toBe(403);
	});

	it("lets any signed-in user inspect their own identity", async () => {
		const res = await api(member, "/api/me");
		expect(res.status).toBe(200);
		const me = (await res.json()) as { user: { email: string }; permissions: string[] };
		expect(me.user.email).toBe("member@example.com");
		expect(me.permissions).toEqual([]);
	});
});

describe("post-login destination", () => {
	it("sends admins to the console", async () => {
		expect(await postLoginDestination(await adminSessionUserId())).toBe(
			"/admin",
		);
	});

	it("sends regular users to /me", async () => {
		expect(await postLoginDestination(await memberSessionUserId())).toBe(
			"/me",
		);
	});
});

async function adminSessionUserId(): Promise<string> {
	const me = await api(admin, "/api/me");
	const data = (await me.json()) as { user: { id: string } };
	return data.user.id;
}

async function memberSessionUserId(): Promise<string> {
	const me = await api(member, "/api/me");
	const data = (await me.json()) as { user: { id: string } };
	return data.user.id;
}