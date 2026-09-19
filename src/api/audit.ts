import type { ApiRoute } from "./router";
import { intParam, json } from "../http";

export function registerAuditRoutes(): ApiRoute[] {
	return [
		{
			method: "GET",
			pattern: /^\/api\/audit$/,
			permission: "audit:read",
			handler: async ({ url, db }) => {
				const page = intParam(url, "page", 1, 1);
				const pageSize = intParam(url, "pageSize", 50, 1, 200);
				const [list, count] = await Promise.all([
					db
						.prepare(
							"SELECT actor_email, action, target_type, target_id, detail, created_at FROM audit_log ORDER BY created_at DESC, id DESC LIMIT ?1 OFFSET ?2",
						)
						.bind(pageSize, (page - 1) * pageSize)
						.all(),
					db.prepare("SELECT COUNT(*) AS total FROM audit_log").first<{ total: number }>(),
				]);
				return json({ entries: list.results, total: count?.total ?? 0, page, pageSize });
			},
		},
	];
}