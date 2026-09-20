import type { ApiRoute } from "./router";
import { intParam, isUniqueError, json, readJson, splitCsv } from "../http";
import { ApiError } from "../errors";
import { writeAudit } from "../repositories/audit";
import {
	deleteRole,
	findRoleById,
	insertRole,
	listRoles,
	setRolePermissions,
	updateRole,
} from "../repositories/roles";

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

export function registerRoleRoutes(): ApiRoute[] {
	return [
		{
			method: "GET",
			pattern: /^\/api\/roles$/,
			permission: "roles:read",
			handler: async ({ db }) => {
				const list = await listRoles(db);
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
				if (!NAME_RE.test(name)) throw new ApiError("invalid_name", 400);
				try {
					const role = await insertRole(ctx.db, name, description);
					await setRolePermissions(ctx.db, role!.id, permissions);
					await writeAudit(ctx.db, ctx.userId, "role.create", "role", role!.id, JSON.stringify({ name }));
					return json({ ok: true, id: role!.id });
				} catch (e) {
					if (isUniqueError(e)) throw new ApiError("role_taken", 409);
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
				const existing = await findRoleById(ctx.db, id);
				if (!existing) throw new ApiError("not_found", 404);
				const body = await readJson(ctx.request);
				const name = typeof body?.name === "string" ? body.name.trim() : existing.name;
				const description =
					typeof body?.description === "string" ? body.description.trim() : undefined;
				if (!NAME_RE.test(name)) throw new ApiError("invalid_name", 400);
				if (existing.is_system && name !== existing.name) {
					throw new ApiError("builtin_role", 400);
				}
				try {
					await updateRole(ctx.db, id, name, description);
				} catch (e) {
					if (isUniqueError(e)) throw new ApiError("role_taken", 409);
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
				const existing = await findRoleById(ctx.db, id);
				if (!existing) throw new ApiError("not_found", 404);
				if (existing.is_system) throw new ApiError("builtin_role", 400);
				await deleteRole(ctx.db, id);
				await writeAudit(ctx.db, ctx.userId, "role.delete", "role", id, JSON.stringify({ name: existing.name }));
				return json({ ok: true });
			},
		},
	];
}