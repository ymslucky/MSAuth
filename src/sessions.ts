import { SESSION_COOKIE } from "./constants";
import { getCookie, randomToken } from "./http";

export interface AdminSession {
	userId: string;
}

/** Resolves the admin session from the request cookie, if still valid. */
export async function authenticate(
	db: D1Database,
	request: Request,
): Promise<AdminSession | null> {
	const sessionId = getCookie(request, SESSION_COOKIE);
	if (!sessionId) return null;
	const session = await db
		.prepare(
			`SELECT user_id FROM admin_sessions
			WHERE id = ?1 AND expires_at > CURRENT_TIMESTAMP`,
		)
		.bind(sessionId)
		.first<{ user_id: string }>();
	return session ? { userId: session.user_id } : null;
}

/** Creates a server-side session row and returns its opaque id. */
export async function createAdminSession(
	db: D1Database,
	userId: string,
	ttlSeconds: number,
): Promise<string> {
	const sessionId = randomToken();
	await db
		.prepare(
			"INSERT INTO admin_sessions (id, user_id, expires_at) VALUES (?1, ?2, datetime('now', ?3))",
		)
		.bind(sessionId, userId, `+${ttlSeconds} seconds`)
		.run();
	return sessionId;
}

/** Deletes a session row; the cookie becomes useless immediately. */
export async function deleteAdminSession(
	db: D1Database,
	sessionId: string,
): Promise<void> {
	await db.prepare("DELETE FROM admin_sessions WHERE id = ?1").bind(sessionId).run();
}