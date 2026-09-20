import type { ApiRoute } from "./router";
import { isUniqueError, json, readJson } from "../http";
import { ApiError } from "../errors";
import { writeAudit } from "../repositories/audit";
import { deletePermission, insertPermission, listPermissions } from "../repositories/permissions";

interface PermissionRow {
	id: string;
	code: string;
	description: string;
}

const CODE_RE = /^[a-z][a-z0-9]*:[a-z][a-z0-9]*$/;

export function registerPermissionRoutes(): ApiRoute[] {
	return [
		{
			method: "GET",
			pattern: /^\/api\/permissions$/,
			permission: "permissions:read",
			handler: async ({ db }) => {
				const list = await listPermissions(db);
				return json({ permissions: list.results });
			},
		},
		{
			method: "POST",
			pattern: /^\/api\/permissions$/,
			permission: "permissions:write",
			handler: async (ctx) => {
				const body = await readJson(ctx.request);
				const code = typeof body?.code === "string" ? body.code.trim() : "";
				const description =
					typeof body?.description === "string" ? body.description.trim() : "";
				if (!CODE_RE.test(code)) throw new ApiError("invalid_code", 400);
				try {
					await insertPermission(ctx.db, code, description);
					await writeAudit(ctx.db, ctx.userId, "permission.create", "permission", code, JSON.stringify({ code, description }));
					return json({ ok: true });
				} catch (e) {
					if (isUniqueError(e)) throw new ApiError("permission_taken", 409);
					throw e;
				}
			},
		},
		{
			method: "DELETE",
			pattern: /^\/api\/permissions\/([a-z0-9-]+)$/,
			permission: "permissions:write",
			handler: async (ctx) => {
				await deletePermission(ctx.db, ctx.params[0]);
				await writeAudit(ctx.db, ctx.userId, "permission.delete", "permission", ctx.params[0], "");
				return json({ ok: true });
			},
		},
	];
}