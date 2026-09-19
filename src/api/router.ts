import { json } from "../http";
import { authenticate } from "../sessions";
import { hasPermission, getUserPermissionCodes } from "../authz";
import { registerUserRoutes } from "./users";
import { registerRoleRoutes } from "./roles";
import { registerPermissionRoutes } from "./permissions";
import { registerAuditRoutes } from "./audit";

export interface ApiContext {
	request: Request;
	url: URL;
	db: D1Database;
	userId: string;
	/** Regex capture groups from the matched route pattern. */
	params: string[];
}

export interface ApiRoute {
	method: string;
	pattern: RegExp;
	/** Permission code required; omit for session-only endpoints. */
	permission?: string;
	handler: (ctx: ApiContext) => Promise<Response>;
}

const routes: ApiRoute[] = [
	...registerUserRoutes(),
	...registerRoleRoutes(),
	...registerPermissionRoutes(),
	...registerAuditRoutes(),
];

/**
 * Management API dispatcher: session authentication, permission checks and
 * routing live here; the handlers themselves only implement their resource.
 */
export async function handleApi(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url);
	const path = url.pathname;
	const method = request.method;
	const db = env.AUTH_DB;

	// Any signed-in user may inspect their own identity.
	if (path === "/api/me" && method === "GET") {
		const session = await authenticate(db, request);
		if (!session) return json({ error: "unauthorized" }, 401);
		const user = await db
			.prepare("SELECT id, email, created_at FROM user WHERE id = ?")
			.bind(session.userId)
			.first<{ id: string; email: string; created_at: string }>();
		if (!user) return json({ error: "unauthorized" }, 401);
		return json({
			user,
			roles: await getUserRoles(db, session.userId),
			permissions: await getUserPermissionCodes(db, session.userId),
		});
	}

	for (const route of routes) {
		if (route.method !== method) continue;
		const match = path.match(route.pattern);
		if (!match) continue;

		const session = await authenticate(db, request);
		if (!session) return json({ error: "unauthorized" }, 401);
		if (
			route.permission &&
			!(await hasPermission(db, session.userId, route.permission))
		) {
			return json({ error: "forbidden" }, 403);
		}

		return route.handler({
			request,
			url,
			db,
			userId: session.userId,
			params: match.slice(1),
		});
	}
	return json({ error: "not_found" }, 404);
}

async function getUserRoles(db: D1Database, userId: string): Promise<string[]> {
	const result = await db
		.prepare(
			`SELECT r.name FROM role r JOIN user_role ur ON ur.role_id = r.id
			WHERE ur.user_id = ?1 ORDER BY r.name`,
		)
		.bind(userId)
		.all<{ name: string }>();
	return result.results.map((r) => r.name);
}