
/**
 * Records a management operation. Fire-and-forget semantics are fine for a
 * single-user-scale deployment; the insert is awaited so D1 batches stay
 * consistent.
 */
export async function writeAudit(
	db: D1Database,
	actorId: string,
	action: string,
	targetType: string,
	targetId: string,
	detail: string,
): Promise<void> {
	const actor = await db
		.prepare("SELECT email FROM user WHERE id = ?1")
		.bind(actorId)
		.first<{ email: string }>();
	await db
		.prepare(
			"INSERT INTO audit_log (actor_id, actor_email, action, target_type, target_id, detail) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
		)
		.bind(actorId, actor?.email ?? "", action, targetType, targetId, detail)
		.run();
}