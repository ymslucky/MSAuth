import { Hono } from "hono";
import { intParam, json } from "../http";
import { requirePermission, type ApiEnv } from "./middleware";

export function registerAuditRoutes(): Hono<ApiEnv> {
	const routes = new Hono<ApiEnv>();

	routes.get("/", requirePermission("audit:read"), async (c) => {
		const url = new URL(c.req.url);
		const page = intParam(url, "page", 1, 1);
		const pageSize = intParam(url, "pageSize", 50, 1, 200);
		const [list, count] = await Promise.all([
			c.env.AUTH_DB
				.prepare(
					"SELECT actor_email, action, target_type, target_id, detail, created_at FROM audit_log ORDER BY created_at DESC, id DESC LIMIT ?1 OFFSET ?2",
				)
				.bind(pageSize, (page - 1) * pageSize)
				.all(),
			c.env.AUTH_DB.prepare("SELECT COUNT(*) AS total FROM audit_log").first<{ total: number }>(),
		]);
		return json({ entries: list.results, total: count?.total ?? 0, page, pageSize });
	});

	return routes;
}