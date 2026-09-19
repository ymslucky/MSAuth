import type { ApiRoute } from "./router";
import { intParam, isUniqueError, json, readJson, splitCsv } from "../http";
import { writeAudit } from "../audit";

interface RoleRow {
	id: string;
	name: string;
	description: string;
	is_system: number;
	created_at: string;
	permissions?: string | null;
	user_count?: number;
}

const NAME_RE = /^[a-z][a-z0-9:_-]{1,63}$/i;

function permissionList(body: any): string[] {
	return Array.isArray(body?.permissions)
		? body.permissions.filter((c: unknown) => typeof c === "string")
		: [];
}

async function setRolePermissions(
	db: D1Database,
	roleId: string,
	codes: string[],
): Promise<void> {
	if (!codes.length) {
		await db.prepare("DELETE FROM role_permission WHERE role_id = ?1").bind(roleId).run();
		return;
	}
	await db.batch([
		db.prepare("DELETE FROM role_permission WHERE role_id = ?1").bind(roleId),
		...codes.map((code) =>
			db
				.prepare(
					"INSERT OR IGNORE INTO role_permission (role_id, permission_id) SELECT ?1, id FROM permission WHERE code = ?2",
				)
				.bind(roleId, code),
		),
	]);
}

export function registerRoleRoutes(): ApiRoute[] {
	return [
		{
			method: "GET",
			pattern: /^\/api\/roles$/,
			permission: "roles:read",
			handler: async ({ db }) => {
				const list = await db
					.prepare(
						`SELECT r.id, r.name, r.description, r.is_system, r.created_at,
							(SELECT GROUP_CONCAT(p.code, ',') FROM role_permission rp JOIN permission p ON p.id = rp.permission_id WHERE rp.role_id = r.id) AS permissions,
							(SELECT COUNT(*) FROM user_role ur WHERE ur.role_id = r.id) AS user_count
						FROM role r ORDER BY r.created_at ASC`,
					)
					.all<RoleRow>();
				return json({
					roles: list.results.map((r) => ({
						...r,
						permissions: splitCsv(r.permissions),
					})),
				});
			},
		},
		{
			method: "POST",
			pattern: /^\/api\/roles$/,
			permission: "roles:write",
			handler: async (ctx) => {
				const body = await readJson(ctx.request);
				const name = typeof body?.name === "string" ? body.name.trim() : "";
				const description =
					typeof body?.description === "string" ? body.description.trim() : "";
				const permissions = permissionList(body);
				if (!NAME_RE.test(name)) {
					return json({ error: "invalid_name" }, 400);
				}
				try {
					const role = await ctx.db
						.prepare("INSERT INTO role (name, description) VALUES (?1, ?2) RETURNING id")
						.bind(name, description)
						.first<{ id: string }>();
					await setRolePermissions(ctx.db, role!.id, permissions);
					await writeAudit(ctx.db, ctx.userId, "role.create", "role", role!.id, JSON.stringify({ name }));
					return json({ ok: true, id: role!.id });
				} catch (e) {
					if (isUniqueError(e)) return json({ error: "role_taken" }, 409);
					throw e;
				}
			},
		},
		{
			method: "PATCH",
			pattern: /^\/api\/roles\/([a-z0-9-]+)$/,
			permission: "roles:write",
			handler: async (ctx) => {
				const [id] = ctx.params;
				const existing = await ctx.db
					.prepare("SELECT id, name, is_system FROM role WHERE id = ?1")
					.bind(id)
					.first<{ id: string; name: string; is_system: number }>();
				if (!existing) return json({ error: "not_found" }, 404);
				const body = await readJson(ctx.request);
				const name = typeof body?.name === "string" ? body.name.trim() : existing.name;
				const description =
					typeof body?.description === "string" ? body.description.trim() : undefined;
				if (!NAME_RE.test(name)) {
					return json({ error: "invalid_name" }, 400);
				}
				// System roles keep their name: it is what the bootstrap and
				// built-in protections key on.
				if (existing.is_system && name !== existing.name) {
					return json({ error: "builtin_role" }, 400);
				}
				try {
					if (description === undefined) {
						await ctx.db.prepare("UPDATE role SET name = ?1 WHERE id = ?2").bind(name, id).run();
					} else {
						await ctx.db
							.prepare("UPDATE role SET name = ?1, description = ?2 WHERE id = ?3")
							.bind(name, description, id)
							.run();
					}
				} catch (e) {
					if (isUniqueError(e)) return json({ error: "role_taken" }, 409);
					throw e;
				}
				const permissions =
					body?.permissions === undefined ? undefined : permissionList(body);
				if (permissions) await setRolePermissions(ctx.db, id, permissions);
				await writeAudit(ctx.db, ctx.userId, "role.update", "role", id, JSON.stringify({ name, description, permissions }));
				return json({ ok: true });
			},
		},
		{
			method: "DELETE",
			pattern: /^\/api\/roles\/([a-z0-9-]+)$/,
			permission: "roles:write",
			handler: async (ctx) => {
				const [id] = ctx.params;
				const existing = await ctx.db
					.prepare("SELECT id, name, is_system FROM role WHERE id = ?1")
					.bind(id)
					.first<{ id: string; name: string; is_system: number }>();
				if (!existing) return json({ error: "not_found" }, 404);
				if (existing.is_system) {
					return json({ error: "builtin_role" }, 400);
				}
				await ctx.db.batch([
					ctx.db.prepare("DELETE FROM role_permission WHERE role_id = ?1").bind(id),
					ctx.db.prepare("DELETE FROM user_role WHERE role_id = ?1").bind(id),
					ctx.db.prepare("DELETE FROM role WHERE id = ?1").bind(id),
				]);
				await writeAudit(ctx.db, ctx.userId, "role.delete", "role", id, JSON.stringify({ name: existing.name }));
				return json({ ok: true });
			},
		},
	];
}