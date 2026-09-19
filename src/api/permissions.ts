import type { ApiRoute } from "./router";
import { isUniqueError, json, readJson } from "../http";
import { writeAudit } from "../audit";

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
				const list = await db
					.prepare("SELECT id, code, description FROM permission ORDER BY code ASC")
					.all<PermissionRow>();
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
				if (!CODE_RE.test(code)) {
					return json({ error: "invalid_code" }, 400);
				}
				try {
					await ctx.db
						.prepare("INSERT INTO permission (code, description) VALUES (?1, ?2)")
						.bind(code, description)
						.run();
					await writeAudit(ctx.db, ctx.userId, "permission.create", "permission", code, JSON.stringify({ code, description }));
					return json({ ok: true });
				} catch (e) {
					if (isUniqueError(e)) return json({ error: "permission_taken" }, 409);
					throw e;
				}
			},
		},
		{
			method: "DELETE",
			pattern: /^\/api\/permissions\/([a-z0-9-]+)$/,
			permission: "permissions:write",
			handler: async (ctx) => {
				const [id] = ctx.params;
				await ctx.db.batch([
					ctx.db.prepare("DELETE FROM role_permission WHERE permission_id = ?1").bind(id),
					ctx.db.prepare("DELETE FROM permission WHERE id = ?1").bind(id),
				]);
				await writeAudit(ctx.db, ctx.userId, "permission.delete", "permission", id, "");
				return json({ ok: true });
			},
		},
	];
}