import { env, SELF } from "cloudflare:test";
import { beforeAll, expect, it } from "vitest";
import {
	applyMigrations,
	registerUserViaPassword,
	ORIGIN,
} from "./helpers";

beforeAll(async () => {
	await applyMigrations();
});

it("rejects new-user signups when registration is disabled", async () => {
	await env.AUTH_STORAGE.put("config:registration", "off");
	await expect(
		registerUserViaPassword("blocked@example.com", "password123"),
	).rejects.toThrow(/registration_disabled/);
	await env.AUTH_STORAGE.delete("config:registration");
});

it("still allows existing users to sign in while disabled", async () => {
	// Create the user while registration is enabled.
	const jar = await registerUserViaPassword("kept@example.com", "password123");
	expect(jar.has("__Host-admin_session")).toBe(true);

	// Re-login via the password login form while disabled.
	await env.AUTH_STORAGE.put("config:registration", "off");
	const login = await SELF.fetch(ORIGIN + "/admin/login", { redirect: "manual" });
	const authorizeUrl = login.headers.get("location")!;
	const authRes = await SELF.fetch(authorizeUrl, {
		headers: { cookie: login.headers.getSetCookie().join("; ") },
		redirect: "manual",
	});
	const cookies = [
		...login.headers.getSetCookie(),
		...authRes.headers.getSetCookie(),
	]
		.map((c) => c.split(";")[0])
		.join("; ");

	const loginRes = await SELF.fetch(ORIGIN + "/password/authorize", {
		method: "POST",
		redirect: "manual",
		headers: {
			cookie: cookies,
			"content-type": "application/x-www-form-urlencoded",
		},
		body: new URLSearchParams({ email: "kept@example.com", password: "password123" }),
	});
	expect(loginRes.status).toBe(302);
	expect(loginRes.headers.get("location")).toContain("/admin/callback?code=");
});