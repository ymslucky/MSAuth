import { Hono, type MiddlewareHandler } from "hono";
import { authenticate } from "../sessions";
import { getUserPermissionCodes } from "../authz";
import { registerUserRoutes } from "./users";
import { registerRoleRoutes } from "./roles";
import { registerPermissionRoutes } from "./permissions";
import { registerAuditRoutes } from "./audit";

import { requirePermission, type ApiEnv } from "./middleware";

/** Session middleware: resolves the admin session for every /api request. */
const sessionMiddleware: MiddlewareHandler<ApiEnv> = async (c, next) => {
	const session = await authenticate(c.env.AUTH_DB, c.req.raw);
	if (!session) return c.json({ error: "unauthorized" }, 401);
	c.set("userId", session.userId);
	await next();
};

/** The management API, mounted under /api in index.ts. */
const api = new Hono<ApiEnv>();

api.use("/api/*", sessionMiddleware);

// Any signed-in user may inspect their own identity.
api.get("/api/me", async (c) => {
	const db = c.env.AUTH_DB;
	const userId = c.get("userId");
	const user = await db
		.prepare("SELECT id, email, created_at FROM user WHERE id = ?")
		.bind(userId)
		.first<{ id: string; email: string; created_at: string }>();
	if (!user) return c.json({ error: "unauthorized" }, 401);
	return c.json({
		user,
		roles: await getUserRoleNames(db, userId),
		permissions: await getUserPermissionCodes(db, userId),
	});
});

async function getUserRoleNames(db: D1Database, userId: string): Promise<string[]> {
	const result = await db
		.prepare(
			`SELECT r.name FROM role r JOIN user_role ur ON ur.role_id = r.id
			WHERE ur.user_id = ?1 ORDER BY r.name`,
		)
		.bind(userId)
		.all<{ name: string }>();
	return result.results.map((r) => r.name);
}

api.route("/api/users", registerUserRoutes());
api.route("/api/roles", registerRoleRoutes());
api.route("/api/permissions", registerPermissionRoutes());
api.route("/api/audit", registerAuditRoutes());

api.notFound((c) => c.json({ error: "not_found" }, 404));

export default api;