import type { ApiRoute } from "./router";
import { intParam, json } from "../http";
import { listAuditEntries } from "../repositories/audit";

export function registerAuditRoutes(): ApiRoute[] {
	return [
		{
			method: "GET",
			pattern: /^\/api\/audit$/,
			permission: "audit:read",
			handler: async ({ url, db }) => {
				const page = intParam(url, "page", 1, 1);
				const pageSize = intParam(url, "pageSize", 50, 1, 200);
				const { entries, total } = await listAuditEntries(db, page, pageSize);
				return json({ entries, total, page, pageSize });
			},
		},
	];
}