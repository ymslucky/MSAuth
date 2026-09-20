
export interface RoleRow {
	id: string;
	name: string;
	description: string;
	is_system: number;
	created_at: string;
	permissions?: string | null;
	user_count?: number;
}

export function listRoles(db: D1Database) {
	return db
		.prepare(
			`SELECT r.id, r.name, r.description, r.is_system, r.created_at,
			(SELECT GROUP_CONCAT(p.code, ',') FROM role_permission rp JOIN permission p ON p.id = rp.permission_id WHERE rp.role_id = r.id) AS permissions,
			(SELECT COUNT(*) FROM user_role ur WHERE ur.role_id = r.id) AS user_count
			FROM role r ORDER BY r.created_at ASC`
		)
		.all<RoleRow>();
}

export function findRoleById(db: D1Database, id: string) {
	return db
		.prepare("SELECT id, name, is_system FROM role WHERE id = ?1")
		.bind(id)
		.first<{ id: string; name: string; is_system: number }>();
}

export function insertRole(db: D1Database, name: string, description: string) {
	return db
		.prepare("INSERT INTO role (name, description) VALUES (?1, ?2) RETURNING id")
		.bind(name, description)
		.first<{ id: string }>();
}

export function updateRole(db: D1Database, id: string, name: string, description?: string) {
	if (description === undefined) {
		return db.prepare("UPDATE role SET name = ?1 WHERE id = ?2").bind(name, id).run();
	}
	return db
		.prepare("UPDATE role SET name = ?1, description = ?2 WHERE id = ?3")
		.bind(name, description, id)
		.run();
}

export async function deleteRole(db: D1Database, id: string) {
	await db.batch([
		db.prepare("DELETE FROM role_permission WHERE role_id = ?1").bind(id),
		db.prepare("DELETE FROM user_role WHERE role_id = ?1").bind(id),
		db.prepare("DELETE FROM role WHERE id = ?1").bind(id),
	]);
}

export async function setRolePermissions(db: D1Database, roleId: string, codes: string[]) {
	if (!codes.length) {
		await db.prepare("DELETE FROM role_permission WHERE role_id = ?1").bind(roleId).run();
		return;
	}
	await db.batch([
		db.prepare("DELETE FROM role_permission WHERE role_id = ?1").bind(roleId),
		...codes.map((code) =>
			db
				.prepare(
					"INSERT OR IGNORE INTO role_permission (role_id, permission_id) SELECT ?1, id FROM permission WHERE code = ?2"
				)
				.bind(roleId, code)
		),
	]);
}