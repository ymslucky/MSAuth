
export interface UserRow {
	id: string;
	email: string;
	created_at: string;
	roles?: string | null;
}

const USER_WITH_ROLES = `SELECT u.id, u.email, u.created_at,
	(SELECT GROUP_CONCAT(r.name, ',') FROM user_role ur JOIN role r ON r.id = ur.role_id WHERE ur.user_id = u.id) AS roles
	FROM user u`;

export function findUserByEmail(db: D1Database, email: string) {
	return db.prepare("SELECT id FROM user WHERE email = ?1").bind(email).first<{ id: string }>();
}

export function createUser(db: D1Database, email: string) {
	return db.prepare("INSERT INTO user (email) VALUES (?1) RETURNING id").bind(email).first<{ id: string }>();
}

export function assignRole(db: D1Database, userId: string, roleName: string) {
	return db
		.prepare("INSERT OR IGNORE INTO user_role (user_id, role_id) SELECT ?1, id FROM role WHERE name = ?2")
		.bind(userId, roleName)
		.run();
}

export async function getUserRoleNames(db: D1Database, userId: string): Promise<string[]> {
	const result = await db
		.prepare(
			`SELECT r.name FROM role r JOIN user_role ur ON ur.role_id = r.id
			WHERE ur.user_id = ?1 ORDER BY r.name`
		)
		.bind(userId)
		.all<{ name: string }>();
	return result.results.map((r) => r.name);
}

export function getUserEmail(db: D1Database, userId: string) {
	return db.prepare("SELECT email FROM user WHERE id = ?1").bind(userId).first<{ email: string }>();
}

export function getUserById(db: D1Database, id: string) {
	return db
		.prepare(`${USER_WITH_ROLES} WHERE u.id = ?1`)
		.bind(id)
		.first<UserRow>();
}

export async function listUsers(
	db: D1Database,
	q: string,
	pageSize: number,
	offset: number
) {
	const [list, count] = await Promise.all([
		db
			.prepare(
				`${USER_WITH_ROLES}
				WHERE ?1 = '' OR u.email LIKE '%' || ?1 || '%'
				ORDER BY u.created_at DESC, u.id DESC
				LIMIT ?2 OFFSET ?3`
			)
			.bind(q, pageSize, offset)
			.all<UserRow>(),
		db
			.prepare("SELECT COUNT(*) AS total FROM user WHERE ?1 = '' OR email LIKE '%' || ?1 || '%'")
			.bind(q)
			.first<{ total: number }>(),
	]);
	return { users: list.results, total: count?.total ?? 0 };
}

export async function updateUserEmail(db: D1Database, id: string, email: string) {
	return db.prepare("UPDATE user SET email = ?1 WHERE id = ?2").bind(email, id).run();
}

export async function deleteUserWithRoles(db: D1Database, id: string) {
	const results = await db.batch([
		db.prepare("DELETE FROM user_role WHERE user_id = ?1").bind(id),
		db.prepare("DELETE FROM user WHERE id = ?1").bind(id),
	]);
	return results[1];
}

export function otherAdminExists(db: D1Database, userId: string) {
	return db
		.prepare(
			`SELECT 1 FROM user_role ur JOIN role r ON r.id = ur.role_id
			WHERE r.name = 'admin' AND ur.user_id != ?1 LIMIT 1`
		)
		.bind(userId)
		.first();
}

export async function getOrCreateUserRow(db: D1Database, email: string): Promise<string> {
	const existing = await findUserByEmail(db, email);
	if (existing) return existing.id;
	const created = await createUser(db, email);
	if (!created) throw new Error(`Unable to process user: ${email}`);
	return created.id;
}

export function grantRole(db: D1Database, userId: string, roleName: string) {
	return assignRole(db, userId, roleName);
}

export async function knownRoleNames(db: D1Database, roles: string[]): Promise<Set<string>> {
	const placeholders = roles.map(() => "?").join(",") || "''";
	const known = await db
		.prepare(`SELECT GROUP_CONCAT(name, ',') AS names FROM role WHERE name IN (${placeholders})`)
		.bind(...roles)
		.first<{ names: string | null }>();
	return new Set((known?.names ?? "").split(",").filter(Boolean));
}

export async function replaceUserRoles(
	db: D1Database,
	userId: string,
	roles: string[]
) {
	await db.batch([
		db.prepare("DELETE FROM user_role WHERE user_id = ?1").bind(userId),
		...roles.map((role) =>
			db
				.prepare(
					"INSERT OR IGNORE INTO user_role (user_id, role_id) SELECT ?1, id FROM role WHERE name = ?2"
				)
				.bind(userId, role)
		),
	]);
}
