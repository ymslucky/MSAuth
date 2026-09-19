import { env, SELF } from "cloudflare:test";
import migration0001 from "../migrations/0001_create_user_table.sql?raw";
import migration0002 from "../migrations/0002_create_rbac.sql?raw";

export const ORIGIN = "https://example.com";

/**
 * Splits a migration file into individual statements. D1 exec() runs one
 * statement per line, which breaks multi-line CREATE TABLE statements, so we
 * split on semicolons and strip comment lines ourselves.
 */
function toStatements(sql: string): string[] {
	return sql
		.split(";")
		.map((statement) =>
			statement
				.split("\n")
				.filter((line) => !line.trimStart().startsWith("--"))
				.join("\n")
				.trim(),
		)
		.filter((statement) => statement.length > 0);
}

/** Apply every D1 migration to the test database. */
export async function applyMigrations(): Promise<void> {
	for (const migration of [migration0001, migration0002]) {
		const statements = toStatements(migration).map((statement) =>
			env.AUTH_DB.prepare(statement),
		);
		await env.AUTH_DB.batch(statements);
	}
}

/** Collects Set-Cookie values and replays them on subsequent requests. */
export class CookieJar {
	private cookies = new Map<string, string>();

	absorb(response: Response): void {
		const setCookies = response.headers.getSetCookie?.() ?? [];
		for (const cookie of setCookies) {
			const pair = cookie.split(";")[0] ?? "";
			const eq = pair.indexOf("=");
			if (eq > -1) {
				this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
			}
		}
	}

	has(name: string): boolean {
		return this.cookies.has(name);
	}

	header(): string {
		return Array.from(this.cookies.entries())
			.map(([name, value]) => `${name}=${value}`)
			.join("; ");
	}
}

/**
 * Drives the real admin OAuth + password registration flow end to end:
 * /admin/login -> /authorize -> /password/register -> code verification
 * -> /admin/callback -> session cookie.
 */
export async function registerUserViaPassword(
	email: string,
	password: string,
): Promise<CookieJar> {
	const jar = new CookieJar();

	// 1. Start the admin login flow (sets the admin_oauth cookie).
	const loginRes = await SELF.fetch(ORIGIN + "/admin/login", { redirect: "manual" });
	jar.absorb(loginRes);
	const authorizeUrl = loginRes.headers.get("location");
	if (!authorizeUrl?.includes("/authorize")) {
		throw new Error("admin login did not redirect to /authorize");
	}

	// 2. Establish the issuer authorization state cookie.
	const authRes = await SELF.fetch(authorizeUrl, {
		headers: { cookie: jar.header() },
		redirect: "manual",
	});
	jar.absorb(authRes);

	// 3. Open the registration form (sets the provider state cookie).
	const regStart = await SELF.fetch(ORIGIN + "/password/register", {
		headers: { cookie: jar.header() },
		redirect: "manual",
	});
	jar.absorb(regStart);

	// 4. Submit registration; the provider emails (stores) a code.
	const regRes = await SELF.fetch(ORIGIN + "/password/register", {
		method: "POST",
		redirect: "manual",
		headers: {
			cookie: jar.header(),
			"content-type": "application/x-www-form-urlencoded",
		},
		body: new URLSearchParams({ action: "register", email, password, repeat: password }),
	});
	jar.absorb(regRes);
	if (!regRes.ok) {
		throw new Error(
			"registration step failed: " + regRes.status + " " + (await regRes.text()).slice(0, 300),
		);
	}

	// 5. Read the verification code from KV.
	const code = await env.AUTH_STORAGE.get("debug:code:" + email);
	if (!code) throw new Error("verification code not found in KV for " + email);

	// 6. Verify the code; the issuer redirects to /admin/callback?code&state.
	const verifyRes = await SELF.fetch(ORIGIN + "/password/register", {
		method: "POST",
		redirect: "manual",
		headers: {
			cookie: jar.header(),
			"content-type": "application/x-www-form-urlencoded",
		},
		body: new URLSearchParams({ action: "verify", code }),
	});
	jar.absorb(verifyRes);
	const callbackUrl = verifyRes.headers.get("location");
	if (!callbackUrl || !callbackUrl.includes("/admin/callback")) {
		throw new Error(
			"expected redirect to /admin/callback, got: " + callbackUrl +
				" (status " + verifyRes.status + "): " + (await verifyRes.text()).slice(0, 300),
		);
	}

	// 7. Exchange the authorization code for an admin session.
	const callbackRes = await SELF.fetch(callbackUrl, {
		headers: { cookie: jar.header() },
		redirect: "manual",
	});
	jar.absorb(callbackRes);
	if (!jar.has("admin_session")) {
		throw new Error("admin_session cookie was not set after the callback");
	}
	return jar;
}

/** Convenience request against the management API with a session. */
export function api(
	jar: CookieJar,
	path: string,
	init?: { method?: string; body?: unknown },
): Promise<Response> {
	return SELF.fetch(ORIGIN + path, {
		method: init?.method ?? "GET",
		headers: {
			cookie: jar.header(),
			...(init?.body !== undefined
				? { "content-type": "application/json" }
				: {}),
		},
		body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
		redirect: "manual",
	});
}