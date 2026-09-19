
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