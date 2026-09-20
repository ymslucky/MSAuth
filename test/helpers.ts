import { env, SELF } from "cloudflare:test";
import migration0001 from "../migrations/0001_schema.sql?raw";
import migration0002 from "../migrations/0002_seed.sql?raw";
import { hasAnyPermission } from "../src/authz";

export const ORIGIN = "https://example.com";

/** Strip SQL comment lines, then split into individual statements. */
function toStatements(sql: string): string[] {
	const withoutComments = sql
		.split("\n")
		.filter((line) => !line.trimStart().startsWith("--"))
		.join("\n");
	return withoutComments
		.split(";")
		.map((statement) => statement.trim())
		.filter((statement) => statement.length > 0);
}

/** Applies every D1 migration to the test database. */
export async function applyMigrations(): Promise<void> {
	const migrations = [migration0001, migration0002];
	let statements: ReturnType<typeof env.AUTH_DB.prepare>[] = [];
	for (const migration of migrations) {
		statements = statements.concat(
			toStatements(migration).map((statement) => env.AUTH_DB.prepare(statement)),
		);
	}
	await env.AUTH_DB.batch(statements);
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
 * Creates a user with the given roles directly in D1 and an active admin
 * session row, returning a cookie jar that authenticates as that user.
 *
 * Used instead of driving the real OAuth flow: GitHub's outbound endpoints
 * cannot be mocked in this environment, so tests exercise the session layer
 * directly. The flow itself is asserted separately (redirect shapes, error
 * paths) without outbound calls.
 */
export async function createTestSession(
	email: string,
	roles: string[] = ["user"],
): Promise<CookieJar> {
	const db = env.AUTH_DB;
	let row = await db
		.prepare("SELECT id FROM user WHERE email = ?1")
		.bind(email)
		.first<{ id: string }>();
	if (!row) {
		row = await db
			.prepare("INSERT INTO user (email) VALUES (?1) RETURNING id")
			.bind(email)
			.first<{ id: string }>();
	}
	const userId = row!.id;
	for (const role of roles) {
		await db
			.prepare(
				"INSERT OR IGNORE INTO user_role (user_id, role_id) SELECT ?1, id FROM role WHERE name = ?2",
			)
			.bind(userId, role)
			.run();
	}
	const sessionId = "test-session-" + crypto.randomUUID();
	await db
		.prepare(
			"INSERT INTO admin_sessions (id, user_id, expires_at) VALUES (?1, ?2, datetime('now', '+7 days'))",
		)
		.bind(sessionId, userId)
		.run();
	const jar = new CookieJar();
	jar.absorb(
		new Response(null, {
			headers: { "set-cookie": `__Host-admin_session=${sessionId}; Path=/` },
		}),
	);
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

/** Where should a freshly signed-in user land? */
export async function postLoginDestination(
	userId: string,
): Promise<string> {
	return (await hasAnyPermission(env.AUTH_DB, userId)) ? "/admin" : "/me";
}