import type { ApiRoute } from "./router";
import { ApiError } from "../errors";
import { json } from "../http";
import { randomToken, readJson } from "../http";
import { findApiKeyOwned } from "../repositories/api-keys";
import {
	deleteApiKey,
	insertApiKey,
	listApiKeysByUser,
} from "../repositories/api-keys";
import { getUserPermissionCodes } from "../authz";

export function registerApiKeyRoutes(): ApiRoute[] {
	return [
		{
			method: "GET",
			pattern: /^\/api\/keys$/,
			handler: async ({ db, userId }) => {
				const list = await listApiKeysByUser(db, userId);
				return json({ keys: list.results });
			},
		},
		{
			method: "POST",
			pattern: /^\/api\/keys$/,
			handler: async (ctx) => {
				const body = await readJson(ctx.request);
				console.log("[keys] body =", JSON.stringify(body));
				const name = typeof body?.name === "string" ? body.name.trim() : "";
				const scopes = Array.isArray(body?.scopes)
					? body.scopes.filter((s: unknown) => typeof s === "string")
					: [];
				if (!name) throw new ApiError("invalid_name", 400);

				// Anti-escalation: scopes must be a subset of what I hold.
				const mine = new Set(await getUserPermissionCodes(ctx.db, ctx.userId));
			console.log("[keys] mine =", [...mine], "userId =", ctx.userId);
				for (const s of scopes) {
					if (!mine.has(s)) throw new ApiError("unknown_scope", 400);
				}

				const expiresAt = typeof body?.expires_in_days === "number" && body.expires_in_days > 0
					? new Date(Date.now() + body.expires_in_days * 86400000).toISOString()
					: null;

				const key = "msa_" + randomToken();
				const keyHash = await sha256Hex(key);
				const id = crypto.randomUUID();
				const prefix = key.slice(0, 12);

				await insertApiKey(ctx.db, {
					id,
					user_id: ctx.userId,
					name,
					key_prefix: prefix,
					key_hash: keyHash,
					scopes: scopes.join(","),
					expires_at: expiresAt,
				});
				return json({ ok: true, id, key, prefix });
			},
		},
		{
			method: "DELETE",
			pattern: /^\/api\/keys\/([a-z0-9-]+)$/,
			handler: async (ctx) => {
				const existing = await findApiKeyOwned(ctx.db, ctx.params[0], ctx.userId);
				if (!existing) throw new ApiError("not_found", 404);
				await deleteApiKey(ctx.db, ctx.params[0]);
				return json({ ok: true });
			},
		},
	];
}

async function sha256Hex(value: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
	return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}