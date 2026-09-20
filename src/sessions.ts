import { SESSION_COOKIE } from "./constants";
import { getCookie } from "./http";
import { randomToken } from "./http";
import { createSession, deleteSession, findSession } from "./repositories/sessions";

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
	const session = await findSession(db, sessionId);
	return session ? { userId: session.user_id } : null;
}

/** Creates a server-side session row and returns its opaque id. */
export async function createAdminSession(
	db: D1Database,
	userId: string,
	ttlSeconds: number,
): Promise<string> {
	const sessionId = randomToken();
	await createSession(db, sessionId, userId, ttlSeconds);
	return sessionId;
}

/** Deletes a session row; the cookie becomes useless immediately. */
export async function deleteAdminSession(db: D1Database, sessionId: string): Promise<void> {
	await deleteSession(db, sessionId);
}