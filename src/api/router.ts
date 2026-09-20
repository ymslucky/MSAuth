import { json } from "../http";
import { ApiError } from "../errors";
import { authenticate } from "../sessions";
import { hasPermission, getUserPermissionCodes } from "../authz";
import { authenticateApiKey } from "../authz";
import { getUserRoleNames } from "../users";
import { registerUserRoutes } from "./users";
import { registerRoleRoutes } from "./roles";
import { registerPermissionRoutes } from "./permissions";
import { registerAuditRoutes } from "./audit";
import { registerApiKeyRoutes } from "./keys";

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
	...registerApiKeyRoutes(),
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

	// Identity: session cookie first, then Bearer API key.
	let userId: string;
	let keyScopes: Set<string> | null = null;
	const session = await authenticate(db, request);
	if (session) {
		userId = session.userId;
	} else {
		const authHeader = request.headers.get("Authorization") ?? '';
		const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : '';
		const key = await authenticateApiKey(db, bearerToken);
		if (!key) return json({ error: "unauthorized" }, 401);
		userId = key.userId;
		keyScopes = key.scopes;
	}

	if (path === "/api/me" && method === "GET") {
		const user = await db
			.prepare("SELECT id, email, created_at FROM user WHERE id = ?")
			.bind(userId)
			.first<{ id: string; email: string; created_at: string }>();
		if (!user) return json({ error: "unauthorized" }, 401);
		return json({
			user,
			roles: await getUserRoleNames(db, userId),
			permissions: keyScopes
				? [...keyScopes]
				: await getUserPermissionCodes(db, userId),
		});
	}

	const route = routes.find((r) => r.method === method && r.pattern.test(path));
	if (!route) return json({ error: "not_found" }, 404);
	if (route.permission) {
		const allowed = keyScopes
			? keyScopes.has(route.permission)
			: await hasPermission(db, userId, route.permission);
		if (!allowed) return json({ error: "forbidden" }, 403);
	}
	const params = path.match(route.pattern)!.slice(1);
	try {
		return await route.handler({ request, url, db, userId, params });
	} catch (e) {
		if (e instanceof ApiError) return json({ error: e.code }, e.status);
		throw e;
	}
}