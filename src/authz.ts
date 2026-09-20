
/** True when the user holds the given permission through any role. */
export async function hasPermission(
	db: D1Database,
	userId: string,
	permission: string,
): Promise<boolean> {
	const result = await db
		.prepare(
			`SELECT 1 FROM user_role ur
			JOIN role_permission rp ON rp.role_id = ur.role_id
			JOIN permission p ON p.id = rp.permission_id
			WHERE ur.user_id = ?1 AND p.code = ?2
			LIMIT 1`,
		)
		.bind(userId, permission)
		.first();
	return !!result;
}

/** True when the user holds at least one management permission. */
export async function hasAnyPermission(
	db: D1Database,
	userId: string,
): Promise<boolean> {
	const result = await db
		.prepare(
			`SELECT 1 FROM user_role ur
			JOIN role_permission rp ON rp.role_id = ur.role_id
			WHERE ur.user_id = ?1
			LIMIT 1`,
		)
		.bind(userId)
		.first();
	return !!result;
}
/** All permission codes the user holds through their roles. */
export async function getUserPermissionCodes(
	db: D1Database,
	userId: string,
): Promise<string[]> {
	const result = await db
		.prepare(
			`SELECT DISTINCT p.code FROM permission p
			JOIN role_permission rp ON rp.permission_id = p.id
			JOIN user_role ur ON ur.role_id = rp.role_id
			WHERE ur.user_id = ?1
			ORDER BY p.code`,
		)
		.bind(userId)
		.all<{ code: string }>();
	return result.results.map((r) => r.code);
}
/**
 * Authenticates a Bearer API key. Returns the owning user and the key's
 * scopes (which act as a standalone permission set, independent of RBAC).
 */
export async function authenticateApiKey(
	db: D1Database,
	token: string,
): Promise<{ userId: string; scopes: Set<string>; keyId: string } | null> {
	if (!token.startsWith("msa_")) return null;
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
	const keyHash = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
	const row = await db
		.prepare(
			"SELECT id, user_id, scopes, expires_at FROM api_key WHERE key_hash = ?1 AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)",
		)
		.bind(keyHash)
		.first<{ id: string; user_id: string; scopes: string; expires_at: string | null }>();
	if (!row) return null;
	return { userId: row.user_id, scopes: new Set(row.scopes.split(",").filter(Boolean)), keyId: row.id };
}