
export async function writeAudit(
	db: D1Database,
	actorId: string,
	action: string,
	targetType: string,
	targetId: string,
	detail: string
) {
	const actor = await db
		.prepare("SELECT email FROM user WHERE id = ?1")
		.bind(actorId)
		.first<{ email: string }>();
	await db
		.prepare(
			"INSERT INTO audit_log (actor_id, actor_email, action, target_type, target_id, detail) VALUES (?1, ?2, ?3, ?4, ?5, ?6)"
		)
		.bind(actorId, actor?.email ?? "", action, targetType, targetId, detail)
		.run();
}
export async function listAuditEntries(
	db: D1Database,
	page: number,
	pageSize: number
) {
	const [list, count] = await Promise.all([
		db
			.prepare(
				"SELECT actor_email, action, target_type, target_id, detail, created_at FROM audit_log ORDER BY created_at DESC, id DESC LIMIT ?1 OFFSET ?2"
			)
			.bind(pageSize, (page - 1) * pageSize)
			.all(),
		db.prepare("SELECT COUNT(*) AS total FROM audit_log").first<{ total: number }>(),
	]);
	return { entries: list.results, total: count?.total ?? 0 };
}