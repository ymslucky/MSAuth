
export function findSession(db: D1Database, sessionId: string) {
	return db
		.prepare(
			`SELECT user_id FROM admin_sessions
			WHERE id = ?1 AND expires_at > CURRENT_TIMESTAMP`
		)
		.bind(sessionId)
		.first<{ user_id: string }>();
}

export function createSession(db: D1Database, sessionId: string, userId: string, ttlSeconds: number) {
	return db
		.prepare(
			"INSERT INTO admin_sessions (id, user_id, expires_at) VALUES (?1, ?2, datetime('now', ?3))"
		)
		.bind(sessionId, userId, `+${ttlSeconds} seconds`)
		.run();
}

export function deleteSession(db: D1Database, sessionId: string) {
	return db.prepare("DELETE FROM admin_sessions WHERE id = ?1").bind(sessionId).run();
}