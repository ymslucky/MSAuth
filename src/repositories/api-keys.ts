
export interface ApiKeyRow {
	id: string;
	user_id: string;
	name: string;
	key_prefix: string;
	key_hash: string;
	scopes: string;
	created_at: string;
	last_used_at: string | null;
	expires_at: string | null;
}

export function insertApiKey(
	db: D1Database,
	row: { id: string; user_id: string; name: string; key_prefix: string; key_hash: string; scopes: string; expires_at: string | null }
) {
	return db
		.prepare(
			"INSERT INTO api_key (id, user_id, name, key_prefix, key_hash, scopes, expires_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)"
		)
		.bind(row.id, row.user_id, row.name, row.key_prefix, row.key_hash, row.scopes, row.expires_at)
		.run();
}

export function listApiKeysByUser(db: D1Database, userId: string) {
	return db
		.prepare(
			"SELECT id, name, key_prefix, scopes, created_at, last_used_at, expires_at FROM api_key WHERE user_id = ?1 ORDER BY created_at DESC"
		)
		.bind(userId)
		.all();
}

export function findApiKeyByHash(db: D1Database, keyHash: string) {
	return db
		.prepare("SELECT * FROM api_key WHERE key_hash = ?1")
		.bind(keyHash)
		.first<{ id: string; user_id: string; scopes: string; expires_at: string | null }>();
}

export function findApiKeyOwned(db: D1Database, id: string, userId: string) {
	return db
		.prepare("SELECT id, name FROM api_key WHERE id = ?1 AND user_id = ?2")
		.bind(id, userId)
		.first<{ id: string; name: string }>();
}

export function deleteApiKey(db: D1Database, id: string) {
	return db.prepare("DELETE FROM api_key WHERE id = ?1").bind(id).run();
}

export function touchApiKey(db: D1Database, id: string) {
	return db
		.prepare("UPDATE api_key SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?1")
		.bind(id)
		.run();
}