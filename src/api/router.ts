import { json } from "../http";
import { ApiError } from "../errors";
import { authenticate } from "../sessions";
import { hasPermission, getUserPermissionCodes } from "../authz";
import { getUserRoleNames } from "../users";
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
 * error conversion live here; handlers only implement their resource and
 * may throw ApiError.
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
			roles: await getUserRoleNames(db, session.userId),
			permissions: await getUserPermissionCodes(db, session.userId),
		});
	}

	const route = routes.find((r) => r.method === method && r.pattern.test(path));
	if (!route) return json({ error: "not_found" }, 404);

	const session = await authenticate(db, request);
	if (!session) return json({ error: "unauthorized" }, 401);
	if (route.permission && !(await hasPermission(db, session.userId, route.permission))) {
		return json({ error: "forbidden" }, 403);
	}
	const params = path.match(route.pattern)!.slice(1);
	try {
		return await route.handler({ request, url, db, userId: session.userId, params });
	} catch (e) {
		if (e instanceof ApiError) return json({ error: e.code }, e.status);
		throw e;
	}
}