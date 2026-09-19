import type { MiddlewareHandler } from "hono";
import { hasPermission } from "../authz";

export type ApiEnv = {
	Bindings: Env;
	Variables: { userId: string };
};

/**
 * Permission middleware factory: gates a route behind an RBAC permission
 * code, evaluated against the database on every request.
 */
export function requirePermission(permission: string): MiddlewareHandler<ApiEnv> {
	return async (c, next) => {
		const db: D1Database = c.env.AUTH_DB;
		if (!(await hasPermission(db, c.get("userId"), permission))) {
			return c.json({ error: "forbidden" }, 403);
		}
		await next();
	};
}