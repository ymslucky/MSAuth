
export interface PermissionRow {
	id: string;
	code: string;
	description: string;
}

export function listPermissions(db: D1Database) {
	return db
		.prepare("SELECT id, code, description FROM permission ORDER BY code ASC")
		.all<PermissionRow>();
}

export function insertPermission(db: D1Database, code: string, description: string) {
	return db
		.prepare("INSERT INTO permission (code, description) VALUES (?1, ?2)")
		.bind(code, description)
		.run();
}

export async function deletePermission(db: D1Database, id: string) {
	await db.batch([
		db.prepare("DELETE FROM role_permission WHERE permission_id = ?1").bind(id),
		db.prepare("DELETE FROM permission WHERE id = ?1").bind(id),
	]);
}