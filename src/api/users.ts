import type { ApiRoute } from "./router";
import { EMAIL_RE, MAX_QUERY_LENGTH } from "../constants";
import { intParam, isUniqueError, json, readJson, splitCsv } from "../http";
import { writeAudit } from "../audit";
import { isLastAdmin } from "../users";

interface UserRow {
	id: string;
	email: string;
	created_at: string;
	roles?: string | null;
}

const USER_WITH_ROLES = `SELECT u.id, u.email, u.created_at,
	(SELECT GROUP_CONCAT(r.name, ',') FROM user_role ur JOIN role r ON r.id = ur.role_id WHERE ur.user_id = u.id) AS roles
	FROM user u`;

export function registerUserRoutes(): ApiRoute[] {
	return [
		{
			method: "GET",
			pattern: /^\/api\/users$/,
			permission: "users:read",
			handler: async ({ url, db }) => {
				const page = intParam(url, "page", 1, 1);
				const pageSize = intParam(url, "pageSize", 20, 1, 100);
				const q = (url.searchParams.get("q") ?? "").trim();
				if (q.length > MAX_QUERY_LENGTH) {
					return json({ error: "query_too_long" }, 400);
				}
				const [list, count] = await Promise.all([
					db
						.prepare(
							`${USER_WITH_ROLES}
							WHERE ?1 = '' OR u.email LIKE '%' || ?1 || '%'
							ORDER BY u.created_at DESC, u.id DESC
							LIMIT ?2 OFFSET ?3`,
						)
						.bind(q, pageSize, (page - 1) * pageSize)
						.all<UserRow>(),
					db
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
			},
		},
		{
			method: "GET",
			pattern: /^\/api\/users\/([a-z0-9-]+)$/,
			permission: "users:read",
			handler: async ({ db, params }) => {
				const [id] = params;
				const user = await db
					.prepare(`${USER_WITH_ROLES} WHERE u.id = ?1`)
					.bind(id)
					.first<UserRow>();
				if (!user) return json({ error: "not_found" }, 404);
				return json({ ...user, roles: splitCsv(user.roles) });
			},
		},
		{
			method: "PATCH",
			pattern: /^\/api\/users\/([a-z0-9-]+)$/,
			permission: "users:write",
			handler: async (ctx) => {
				const [id] = ctx.params;
				const body = await readJson(ctx.request);
				const email =
					typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
				if (!EMAIL_RE.test(email)) return json({ error: "invalid_email" }, 400);
				try {
					const result = await ctx.db
						.prepare("UPDATE user SET email = ?1 WHERE id = ?2")
						.bind(email, id)
						.run();
					if (!result.meta.changes) return json({ error: "not_found" }, 404);
				} catch (e) {
					if (isUniqueError(e)) return json({ error: "email_taken" }, 409);
					throw e;
				}
				await writeAudit(ctx.db, ctx.userId, "user.update", "user", id, JSON.stringify({ email }));
				return json({ ok: true });
			},
		},
		{
			method: "DELETE",
			pattern: /^\/api\/users\/([a-z0-9-]+)$/,
			permission: "users:write",
			handler: async (ctx) => {
				const [id] = ctx.params;
				if (id === ctx.userId) return json({ error: "cannot_delete_self" }, 400);
				if (await isLastAdmin(ctx.db, id)) {
					return json({ error: "last_admin" }, 400);
				}
				const result = await ctx.db
					.batch([
						ctx.db.prepare("DELETE FROM user_role WHERE user_id = ?1").bind(id),
						ctx.db.prepare("DELETE FROM user WHERE id = ?1").bind(id),
					])
					.then((results) => results[1]);
				if (!result.meta.changes) return json({ error: "not_found" }, 404);
				await writeAudit(ctx.db, ctx.userId, "user.delete", "user", id, "");
				return json({ ok: true });
			},
		},
		{
			method: "PUT",
			pattern: /^\/api\/users\/([a-z0-9-]+)\/roles$/,
			permission: "users:assign_roles",
			handler: async (ctx) => {
				const [id] = ctx.params;
				const body = await readJson(ctx.request);
				const roles = Array.isArray(body?.roles)
					? body.roles.filter((r: unknown) => typeof r === "string")
					: null;
				if (!roles) return json({ error: "invalid_roles" }, 400);
				const known = await ctx.db
					.prepare(
						`SELECT GROUP_CONCAT(name, ',') AS names FROM role WHERE name IN (${roles.map(() => "?").join(",") || "''"})`,
					)
					.bind(...roles)
					.first<{ names: string | null }>();
				const knownNames = new Set(splitCsv(known?.names));
				for (const role of roles) {
					if (!knownNames.has(role)) return json({ error: "unknown_role", role }, 400);
				}
				if (await isLastAdmin(ctx.db, id, roles)) {
					return json({ error: "last_admin" }, 400);
				}
				await ctx.db.batch([
					ctx.db.prepare("DELETE FROM user_role WHERE user_id = ?1").bind(id),
					...roles.map((role: string) =>
						ctx.db
							.prepare(
								"INSERT OR IGNORE INTO user_role (user_id, role_id) SELECT ?1, id FROM role WHERE name = ?2",
							)
							.bind(id, role),
					),
				]);
				await writeAudit(ctx.db, ctx.userId, "user.assign_roles", "user", id, JSON.stringify({ roles }));
				return json({ ok: true, roles });
			},
		},
	];
}