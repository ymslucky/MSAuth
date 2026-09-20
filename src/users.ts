import { EMAIL_RE } from "./constants";
import { isUniqueError } from "./http";
import { getAdminAllowlist } from "./secrets";

export interface UserRow {
	id: string;
	email: string;
	created_at: string;
	roles?: string | null;
}

export async function getOrCreateUser(env: Env, rawEmail: string): Promise<string> {
	// Normalize once so lookups, storage and allowlist checks all agree on
	// the canonical (lowercase) form - SQLite UNIQUE is case-sensitive.
	const email = rawEmail.trim().toLowerCase();
	const db = env.AUTH_DB;
	const allowlist = await getAdminAllowlist(env);
	let row = await db
		.prepare("SELECT id FROM user WHERE email = ?1")
		.bind(email)
		.first<{ id: string }>();
	if (!row) {
		// Registration gate: new users can only sign up while enabled.
		// Allowlisted admins are always allowed so the operator cannot be
		// locked out.
		if (!allowlist.includes(email.toLowerCase())) {
			const flag = await env.AUTH_STORAGE.get("config:registration");
			if (flag === "off") {
				throw new Error("registration_disabled");
			}
		}
		try {
			row = await db
				.prepare("INSERT INTO user (email) VALUES (?1) RETURNING id")
				.bind(email)
				.first<{ id: string }>();
		} catch (e) {
			if (isUniqueError(e)) {
				row = await db
					.prepare("SELECT id FROM user WHERE email = ?1")
					.bind(email)
					.first<{ id: string }>();
			} else {
				throw e;
			}
		}
		if (!row) throw new Error(`Unable to process user: ${email}`);
		// Every new user gets the default role.
		await db
			.prepare(
				"INSERT OR IGNORE INTO user_role (user_id, role_id) SELECT ?1, id FROM role WHERE name = 'user'",
			)
			.bind(row.id)
			.run();
	}
	// The ADMIN_EMAIL allowlist is the single source of truth for admins.
	// Membership is re-asserted on every login; removal from the list takes
	// effect the next time the user signs in (or when the role is revoked).
	if (allowlist.includes(email.toLowerCase())) {
		await db
			.prepare(
				"INSERT OR IGNORE INTO user_role (user_id, role_id) SELECT ?1, id FROM role WHERE name = 'admin'",
			)
			.bind(row.id)
			.run();
	}
	console.log(`Found or created user ${row.id} with email ${email}`);
	return row.id;
}

export async function getUserRoleNames(
	db: D1Database,
	userId: string,
): Promise<string[]> {
	const result = await db
		.prepare(
			`SELECT r.name FROM role r JOIN user_role ur ON ur.role_id = r.id
			WHERE ur.user_id = ?1 ORDER BY r.name`,
		)
		.bind(userId)
		.all<{ name: string }>();
	return result.results.map((r) => r.name);
}

/**
 * True when `userId` currently holds the admin role and would still hold it
 * after the requested change (either the change keeps admin, or another
 * admin exists).
 */
export async function isLastAdmin(
	db: D1Database,
	userId: string,
	newRoles?: string[],
): Promise<boolean> {
	const current = await getUserRoleNames(db, userId);
	if (!current.includes("admin")) return false;
	if (newRoles && newRoles.includes("admin")) return false;
	const other = await db
		.prepare(
			`SELECT 1 FROM user_role ur JOIN role r ON r.id = ur.role_id
			WHERE r.name = 'admin' AND ur.user_id != ?1 LIMIT 1`,
		)
		.bind(userId)
		.first();
	return !other;
}