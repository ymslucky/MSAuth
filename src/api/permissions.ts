import { Hono } from "hono";
import { isUniqueError, json, readJson } from "../http";
import { writeAudit } from "../audit";
import { requirePermission, type ApiEnv } from "./middleware";

interface PermissionRow {
	id: string;
	code: string;
	description: string;
}

const CODE_RE = /^[a-z][a-z0-9]*:[a-z][a-z0-9]*$/;

export function registerPermissionRoutes(): Hono<ApiEnv> {
	const routes = new Hono<ApiEnv>();

	routes.get("/", requirePermission("permissions:read"), async (c) => {
		const list = await c.env.AUTH_DB
			.prepare("SELECT id, code, description FROM permission ORDER BY code ASC")
			.all<PermissionRow>();
		return json({ permissions: list.results });
	});

	routes.post("/", requirePermission("permissions:write"), async (c) => {
		const body = await readJson(c.req.raw);
		const code = typeof body?.code === "string" ? body.code.trim() : "";
		const description =
			typeof body?.description === "string" ? body.description.trim() : "";
		if (!CODE_RE.test(code)) {
			return json({ error: "invalid_code" }, 400);
		}
		try {
			await c.env.AUTH_DB
				.prepare("INSERT INTO permission (code, description) VALUES (?1, ?2)")
				.bind(code, description)
				.run();
			await writeAudit(c.env.AUTH_DB, c.get("userId"), "permission.create", "permission", code, JSON.stringify({ code, description }));
			return json({ ok: true });
		} catch (e) {
			if (isUniqueError(e)) return json({ error: "permission_taken" }, 409);
			throw e;
		}
	});

	routes.delete("/:id", requirePermission("permissions:write"), async (c) => {
		const id = c.req.param("id");
		const db = c.env.AUTH_DB;
		await db.batch([
			db.prepare("DELETE FROM role_permission WHERE permission_id = ?1").bind(id),
			db.prepare("DELETE FROM permission WHERE id = ?1").bind(id),
		]);
		await writeAudit(db, c.get("userId"), "permission.delete", "permission", id, "");
		return json({ ok: true });
	});

	return routes;
}