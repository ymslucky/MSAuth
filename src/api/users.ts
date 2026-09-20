import type { ApiRoute } from "./router";
import { EMAIL_RE, MAX_QUERY_LENGTH } from "../constants";
import { intParam, isUniqueError, json, readJson, splitCsv } from "../http";
import { ApiError } from "../errors";
import { writeAudit } from "../repositories/audit";
import { isLastAdmin } from "../users";
import {
	deleteUserWithRoles,
	getUserById,
	knownRoleNames,
	listUsers,
	otherAdminExists,
	replaceUserRoles,
	updateUserEmail,
} from "../repositories/users";

interface UserRow {
	id: string;
	email: string;
	created_at: string;
	roles?: string | null;
}

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
				if (q.length > MAX_QUERY_LENGTH) throw new ApiError("query_too_long", 400);
				const { users, total } = await listUsers(db, q, pageSize, (page - 1) * pageSize);
				return json({
					users: users.map((u) => ({ ...u, roles: splitCsv(u.roles) })),
					total,
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
				const user = await getUserById(db, params[0]);
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
				if (!EMAIL_RE.test(email)) throw new ApiError("invalid_email", 400);
				try {
					const result = await updateUserEmail(ctx.db, id, email);
					if (!result.meta.changes) throw new ApiError("not_found", 404);
				} catch (e) {
					if (isUniqueError(e)) throw new ApiError("email_taken", 409);
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
				if (id === ctx.userId) throw new ApiError("cannot_delete_self", 400);
				if (await isLastAdmin(ctx.db, id)) throw new ApiError("last_admin", 400);
				const result = await deleteUserWithRoles(ctx.db, id);
				if (!result.meta.changes) throw new ApiError("not_found", 404);
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
				if (!roles) throw new ApiError("invalid_roles", 400);
				const knownNames = await knownRoleNames(ctx.db, roles);
				for (const role of roles) {
					if (!knownNames.has(role)) throw new ApiError("unknown_role", 400);
				}
				if (await isLastAdmin(ctx.db, id, roles)) {
					throw new ApiError("last_admin", 400);
				}
				await replaceUserRoles(ctx.db, id, roles);
				await writeAudit(ctx.db, ctx.userId, "user.assign_roles", "user", id, JSON.stringify({ roles }));
				return json({ ok: true, roles });
			},
		},
	];
}