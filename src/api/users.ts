import { Hono } from "hono";
import { MAX_QUERY_LENGTH, EMAIL_RE } from "../constants";
import { intParam, isUniqueError, json, readJson, splitCsv } from "../http";
import { writeAudit } from "../audit";
import { isLastAdmin } from "../users";
import { requirePermission, type ApiEnv } from "./middleware";

interface UserRow {
	id: string;
	email: string;
	created_at: string;
	roles?: string | null;
}

const USER_WITH_ROLES = `SELECT u.id, u.email, u.created_at,
	(SELECT GROUP_CONCAT(r.name, ',') FROM user_role ur JOIN role r ON r.id = ur.role_id WHERE ur.user_id = u.id) AS roles
	FROM user u`;

export function registerUserRoutes(): Hono<ApiEnv> {
	const routes = new Hono<ApiEnv>();

	routes.get("/", requirePermission("users:read"), async (c) => {
		const page = intParam(c.req.raw ? new URL(c.req.url) : new URL(c.req.url), "page", 1, 1);
		const pageSize = intParam(new URL(c.req.url), "pageSize", 20, 1, 100);
		const q = (c.req.query("q") ?? "").trim();
		if (q.length > MAX_QUERY_LENGTH) {
			return json({ error: "query_too_long" }, 400);
		}
		const [list, count] = await Promise.all([
			c.env.AUTH_DB
				.prepare(
					`${USER_WITH_ROLES}
					WHERE ?1 = '' OR u.email LIKE '%' || ?1 || '%'
					ORDER BY u.created_at DESC, u.id DESC
					LIMIT ?2 OFFSET ?3`,
				)
				.bind(q, pageSize, (page - 1) * pageSize)
				.all<UserRow>(),
			c.env.AUTH_DB
				.prepare(
					"SELECT COUNT(*) AS total FROM user WHERE ?1 = '' OR email LIKE '%' || ?1 || '%'",
				)
				.bind(q)
				.first<{ total: number }>(),
		]);
		return json({
			users: list.results.map((u) => ({ ...u, roles: splitCsv(u.roles) })),
			total: count?.total ?? 0,
			page,
			pageSize,
		});
	});

	routes.get("/:id", requirePermission("users:read"), async (c) => {
		const id = c.req.param("id");
		const user = await c.env.AUTH_DB
			.prepare(`${USER_WITH_ROLES} WHERE u.id = ?1`)
			.bind(id)
			.first<UserRow>();
		if (!user) return json({ error: "not_found" }, 404);
		return json({ ...user, roles: splitCsv(user.roles) });
	});

	routes.patch("/:id", requirePermission("users:write"), async (c) => {
		const id = c.req.param("id");
		const body = await readJson(c.req.raw);
		const email =
			typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
		if (!EMAIL_RE.test(email)) return json({ error: "invalid_email" }, 400);
		try {
			const result = await c.env.AUTH_DB
				.prepare("UPDATE user SET email = ?1 WHERE id = ?2")
				.bind(email, id)
				.run();
			if (!result.meta.changes) return json({ error: "not_found" }, 404);
		} catch (e) {
			if (isUniqueError(e)) return json({ error: "email_taken" }, 409);
			throw e;
		}
		await writeAudit(c.env.AUTH_DB, c.get("userId"), "user.update", "user", id, JSON.stringify({ email }));
		return json({ ok: true });
	});

	routes.delete("/:id", requirePermission("users:write"), async (c) => {
		const id = c.req.param("id");
		const userId = c.get("userId");
		const db = c.env.AUTH_DB;
		if (id === userId) return json({ error: "cannot_delete_self" }, 400);
		if (await isLastAdmin(db, id)) {
			return json({ error: "last_admin" }, 400);
		}
		const result = await db
			.batch([
				db.prepare("DELETE FROM user_role WHERE user_id = ?1").bind(id),
				db.prepare("DELETE FROM user WHERE id = ?1").bind(id),
			])
			.then((results) => results[1]);
		if (!result.meta.changes) return json({ error: "not_found" }, 404);
		await writeAudit(db, userId, "user.delete", "user", id, "");
		return json({ ok: true });
	});

	routes.put("/:id/roles", requirePermission("users:assign_roles"), async (c) => {
		const id = c.req.param("id");
		const db = c.env.AUTH_DB;
		const userId = c.get("userId");
		const body = await readJson(c.req.raw);
		const roles = Array.isArray(body?.roles)
			? body.roles.filter((r: unknown) => typeof r === "string")
			: null;
		if (!roles) return json({ error: "invalid_roles" }, 400);
		const known = await db
			.prepare(
				`SELECT GROUP_CONCAT(name, ',') AS names FROM role WHERE name IN (${roles.map(() => "?").join(",") || "''"})`,
			)
			.bind(...roles)
			.first<{ names: string | null }>();
		const knownNames = new Set(splitCsv(known?.names));
		for (const role of roles) {
			if (!knownNames.has(role)) return json({ error: "unknown_role", role }, 400);
		}
		if (await isLastAdmin(db, id, roles)) {
			return json({ error: "last_admin" }, 400);
		}
		await db.batch([
			db.prepare("DELETE FROM user_role WHERE user_id = ?1").bind(id),
			...roles.map((role: string) =>
				db
					.prepare(
						"INSERT OR IGNORE INTO user_role (user_id, role_id) SELECT ?1, id FROM role WHERE name = ?2",
					)
					.bind(id, role),
			),
		]);
		await writeAudit(db, userId, "user.assign_roles", "user", id, JSON.stringify({ roles }));
		return json({ ok: true, roles });
	});

	return routes;
}