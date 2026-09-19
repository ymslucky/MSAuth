import { issuer } from "@openauthjs/openauth";
import {
	CloudflareStorage,
	type CloudflareStorageOptions,
} from "@openauthjs/openauth/storage/cloudflare";
import { PasswordProvider } from "@openauthjs/openauth/provider/password";
import { GithubProvider } from "@openauthjs/openauth/provider/github";
import { PasswordUI } from "@openauthjs/openauth/ui/password";
import { createSubjects } from "@openauthjs/openauth/subject";
import { signingKeys } from "@openauthjs/openauth/keys";
import { createLocalJWKSet, jwtVerify } from "jose";
import { array, object, string } from "valibot";
import { ADMIN_HTML } from "./admin";

// This value should be shared between the OpenAuth server Worker and other
// client Workers that you connect to it, so the types and schema validation are
// consistent.
const subjects = createSubjects({
	user: object({
		id: string(),
		roles: array(string()),
	}),
});

const ADMIN_CLIENT_ID = "admin-ui";
const SESSION_COOKIE = "__Host-admin_session";
const OAUTH_STATE_COOKIE = "__Host-admin_oauth";
const BUILTIN_ROLES = ["admin", "user"];
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

interface UserRow {
	id: string;
	email: string;
	created_at: string;
	roles?: string | null;
}

interface RoleRow {
	id: string;
	name: string;
	description: string;
	is_system: number;
	created_at: string;
	permissions?: string | null;
	user_count?: number;
}

interface PermissionRow {
	id: string;
	code: string;
	description: string;
}

interface AccessTokenPayload {
	mode: string;
	type: string;
	sub: string;
	aud: string;
	iss: string;
	properties: {
		id: string;
		roles: string[];
	};
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);

		// Brute-force protection: cap password endpoint POSTs per IP. The
		// binding is configured for 60 requests per 60 second window.
		if (url.pathname.startsWith("/password/") && request.method === "POST") {
			const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
			const outcome = await env.RATE_LIMITER.limit({ key: ip });
			if (!outcome.success) {
				return json({ error: "rate_limited" }, 429);
			}
		}

		// The OpenAuth server.
		const app = await createIssuer(env);

		// Admin console.
		if (url.pathname === "/admin") {
			return handleAdminPage(request, env);
		} else if (url.pathname === "/admin/login") {
			return await handleAdminLogin(request);
		} else if (url.pathname === "/admin/callback") {
			return handleAdminCallback(request, env, ctx, app);
		} else if (url.pathname === "/admin/logout") {
			return handleAdminLogout(request, env);
		} else if (url.pathname.startsWith("/api/")) {
			return handleApi(request, env);
		}

		return app.fetch(request, env, ctx);
	},
} satisfies ExportedHandler<Env>;

/**
 * A secret value is either a Secrets Store binding (production) or a plain
 * string (tests inject mocks so the real store is never required).
 */
type SecretSource = SecretsStoreSecret | string;

function readSecret(source: SecretSource): Promise<string> {
	return typeof source === "string" ? Promise.resolve(source) : source.get();
}

/**
 * Resolves the GitHub credentials. When the Secrets Store is unavailable
 * (e.g. local/integration test environments), degrade to a disabled GitHub
 * provider instead of failing every request; password login and the admin
 * console keep working.
 */
async function resolveGitHubCredentials(env: Env): Promise<[string, string]> {
	try {
		return await Promise.all([
			readSecret(env.GITHUB_CLIENT_ID),
			readSecret(env.GITHUB_CLIENT_SECRET),
		]);
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		if (message.toLowerCase().includes("secret")) {
			console.warn(
				"GitHub secrets unavailable; GitHub login is disabled: " + message,
			);
			return ["", ""];
		}
		throw e;
	}
}

/**
 * Wraps CloudflareStorage so that expirations are clamped to the 60 second
 * KV minimum. The upstream adapter computes `floor((expiry - now) / 1000)`;
 * when request processing takes about a second, the 60 second authorization
 * code expiry turns into 59 and KV rejects the write, breaking code issuance.
 */
function createStorage(env: Env) {
	const storage = CloudflareStorage({
		namespace: env.AUTH_STORAGE as CloudflareStorageOptions["namespace"],
	});
	return {
		...storage,
		async set(
			key: Parameters<typeof storage.set>[0],
			value: Parameters<typeof storage.set>[1],
			expiry?: Date,
		): Promise<void> {
			if (!expiry) return storage.set(key, value);
			const ttl = Math.floor((expiry.getTime() - Date.now()) / 1000);
			await storage.set(
				key,
				value,
				new Date(Date.now() + Math.max(60, ttl) * 1000),
			);
		},
	};
}

async function createIssuer(env: Env) {
	const [clientID, clientSecret] = await resolveGitHubCredentials(env);

	return issuer({
		storage: createStorage(env),
		subjects,
		ttl: {
			access: 60 * 60,
			refresh: 30 * 24 * 60 * 60,
		},
		// Only pre-registered clients may start authorization flows, and only
		// with their exact redirect URI.
		allow: async (input, req) => {
			const origin = new URL(req.url).origin;
			return (
				input.clientID === ADMIN_CLIENT_ID &&
				input.redirectURI === origin + "/admin/callback"
			);
		},
		providers: {
			password: PasswordProvider(
				PasswordUI({
					sendCode: async (email, code) => {
						// This is where you would email the verification code to the
						// user, e.g. using Resend:
						// https://resend.com/docs/send-with-cloudflare-workers
						console.log(`Sending code ${code} to ${email}`);
						// Email delivery is not configured yet; expose the code through
						// storage so integration tests and operators can retrieve it.
						await env.AUTH_STORAGE.put(`debug:code:${email}`, code, {
							expirationTtl: 600,
						});
					},
					copy: {
						input_code: "Code (check Worker logs)",
					},
				}),
			),
			github: GithubProvider({
				clientID,
				clientSecret,
				scopes: ["user:email"],
			}),
		},
		theme: {
			title: "myAuth",
			primary: "#0051c3",
			favicon: "https://workers.cloudflare.com//favicon.ico",
			logo: {
				dark: "https://imagedelivery.net/wSMYJvS3Xw-n339CbDyDIA/db1e5c92-d3a6-4ea9-3e72-155844211f00/public",
				light:
					"https://imagedelivery.net/wSMYJvS3Xw-n339CbDyDIA/fa5a3023-7da9-466b-98a7-4ce01ee6c700/public",
			},
		},
		success: async (ctx, value) => {
			// The GitHub provider resolves to { provider, clientID, tokenset },
			// so the email has to be looked up via the GitHub API.
			const email =
				value.provider === "github"
					? await getGithubEmail(value.tokenset.access)
					: value.email;
			const id = await getOrCreateUser(env, email);
			return ctx.subject("user", {
				id,
				roles: await getUserRoleNames(env.AUTH_DB, id),
			});
		},
	});
}

/* ------------------------------------------------------------------ */
/* Admin console: OAuth login flow                                     */
/* ------------------------------------------------------------------ */

async function handleAdminPage(request: Request, env: Env): Promise<Response> {
	const session = await authenticate(env, request);
	if (!session) {
		return redirect(new URL("/admin/login", new URL(request.url).origin));
	}
	return new Response(ADMIN_HTML, {
		headers: {
			"content-type": "text/html; charset=utf-8",
			"cache-control": "no-store",
			"x-frame-options": "DENY",
			"x-content-type-options": "nosniff",
		},
	});
}

async function handleAdminLogin(request: Request): Promise<Response> {
	const origin = new URL(request.url).origin;
	const state = randomToken();
	const verifier = randomToken();
	const challenge = base64UrlEncode(
		new Uint8Array(
			await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
		),
	);
	return redirect(
		`${origin}/authorize?${new URLSearchParams({
			client_id: ADMIN_CLIENT_ID,
			redirect_uri: `${origin}/admin/callback`,
			response_type: "code",
			state,
			scope: "openid",
			code_challenge: challenge,
			code_challenge_method: "S256",
		})}`,
		[
			setCookieValue(
				OAUTH_STATE_COOKIE,
				btoa(JSON.stringify({ state, verifier })),
				600,
			),
		],
	);
}

async function handleAdminCallback(
	request: Request,
	env: Env,
	ctx: ExecutionContext,
	app: Awaited<ReturnType<typeof createIssuer>>,
): Promise<Response> {
	const url = new URL(request.url);
	const code = url.searchParams.get("code");
	const state = url.searchParams.get("state");
	const oauthError = url.searchParams.get("error");
	let stored: { state?: string; verifier?: string } = {};
	try {
		stored = JSON.parse(atob(getCookie(request, OAUTH_STATE_COOKIE) ?? ""));
	} catch {}

	const fail = (reason: string) => {
		const loginUrl = new URL("/admin/login", url.origin);
		loginUrl.searchParams.set("error", reason);
		return redirect(loginUrl, [setCookieValue(OAUTH_STATE_COOKIE, "", 0)]);
	};
	if (
		oauthError ||
		!code ||
		!state ||
		!stored.state ||
		!stored.verifier ||
		state !== stored.state
	) {
		return fail(oauthError ?? "invalid_state");
	}

	// Exchange the authorization code in-process against our own /token route.
	const tokenResponse = await app.fetch(
		new Request(new URL("/token", url.origin), {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				grant_type: "authorization_code",
				code,
				redirect_uri: new URL("/admin/callback", url.origin).toString(),
				client_id: ADMIN_CLIENT_ID,
				code_verifier: stored.verifier,
			}),
		}),
		env,
		ctx,
	);
	const tokens = (await tokenResponse.json()) as {
		access_token?: string;
		expires_in?: number;
	};
	if (!tokenResponse.ok || !tokens.access_token) {
		return fail("token_exchange_failed");
	}
	try {
		await verifyAccessToken(env, tokens.access_token);
	} catch {
		return fail("invalid_token");
	}

	// The access token is only used to identify the user; the browser gets an
	// opaque server-side session id that can be revoked independently.
	const payload = await verifyAccessToken(env, tokens.access_token);
	const sessionId = randomToken();
	await env.AUTH_DB.prepare(
		"INSERT INTO admin_sessions (id, user_id, expires_at) VALUES (?1, ?2, datetime('now', ?3))",
	)
		.bind(sessionId, payload.properties.id, `+${SESSION_TTL_SECONDS} seconds`)
		.run();
	return redirect(new URL("/admin", url.origin), [
		setCookieValue(OAUTH_STATE_COOKIE, "", 0),
		setCookieValue(SESSION_COOKIE, sessionId, SESSION_TTL_SECONDS),
	]);
}

function handleAdminLogout(request: Request, env: Env): Response {
	const sessionId = getCookie(request, SESSION_COOKIE);
	if (sessionId) {
		env.AUTH_DB.prepare("DELETE FROM admin_sessions WHERE id = ?1").bind(sessionId).run();
	}
	return redirect(new URL("/admin/login", new URL(request.url).origin), [
		setCookieValue(SESSION_COOKIE, "", 0),
	]);
}

/* ------------------------------------------------------------------ */
/* Admin API                                                           */
/* ------------------------------------------------------------------ */

async function handleApi(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url);
	const path = url.pathname;
	const method = request.method;

	const session = await authenticate(env, request);

	// Any signed-in user may inspect their own identity.
	if (path === "/api/me" && method === "GET") {
		if (!session) return json({ error: "unauthorized" }, 401);
		const user = await env.AUTH_DB.prepare(
			"SELECT id, email, created_at FROM user WHERE id = ?",
		)
			.bind(session.userId)
			.first<UserRow>();
		if (!user) return json({ error: "unauthorized" }, 401);
		return json({
			user,
			roles: await getUserRoleNames(env.AUTH_DB, session.userId),
			permissions: await getUserPermissionCodes(env, session.userId),
		});
	}

	// Everything below requires one of the management permissions.
	const required = routePermission(path, method);
	if (!required) return json({ error: "not_found" }, 404);
	if (!session) return json({ error: "unauthorized" }, 401);
	if (!(await hasPermission(env, session.userId, required))) {
		return json({ error: "forbidden" }, 403);
	}
	const userId = session.userId;
	const db = env.AUTH_DB;

	/* Users ---------------------------------------------------------- */

	if (path === "/api/users" && method === "GET") {
		const page = intParam(url, "page", 1, 1);
		const pageSize = intParam(url, "pageSize", 20, 1, 100);
		const q = (url.searchParams.get("q") ?? "").trim();
		const [list, count] = await Promise.all([
			db.prepare(
				`SELECT u.id, u.email, u.created_at,
					(SELECT GROUP_CONCAT(r.name, ',') FROM user_role ur JOIN role r ON r.id = ur.role_id WHERE ur.user_id = u.id) AS roles
				FROM user u
				WHERE ?1 = '' OR u.email LIKE '%' || ?1 || '%'
				ORDER BY u.created_at DESC, u.id DESC
				LIMIT ?2 OFFSET ?3`,
			)
				.bind(q, pageSize, (page - 1) * pageSize)
				.all<UserRow>(),
			db.prepare(
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
	}

	let match = path.match(/^\/api\/users\/([a-z0-9-]+)$/);
	if (match) {
		const id = match[1];
		if (method === "GET") {
			const user = await db
				.prepare(
					`SELECT u.id, u.email, u.created_at,
						(SELECT GROUP_CONCAT(r.name, ',') FROM user_role ur JOIN role r ON r.id = ur.role_id WHERE ur.user_id = u.id) AS roles
					FROM user u WHERE u.id = ?1`,
				)
				.bind(id)
				.first<UserRow>();
			if (!user) return json({ error: "not_found" }, 404);
			return json({ ...user, roles: splitCsv(user.roles) });
		}
		if (method === "PATCH") {
			const body = await readJson(request);
			const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
			if (!EMAIL_RE.test(email)) return json({ error: "invalid_email" }, 400);
			try {
				const result = await db
					.prepare("UPDATE user SET email = ?1 WHERE id = ?2")
					.bind(email, id)
					.run();
				if (!result.meta.changes) return json({ error: "not_found" }, 404);
			} catch (e) {
				if (isUniqueError(e)) return json({ error: "email_taken" }, 409);
				throw e;
			}
			return json({ ok: true });
		}
		if (method === "DELETE") {
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
			return json({ ok: true });
		}
	}

	match = path.match(/^\/api\/users\/([a-z0-9-]+)\/roles$/);
	if (match && method === "PUT") {
		const id = match[1];
		const body = await readJson(request);
		const roles = Array.isArray(body?.roles) ? body.roles.filter((r: unknown) => typeof r === "string") : null;
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
		return json({ ok: true, roles });
	}

	/* Roles ---------------------------------------------------------- */

	if (path === "/api/roles" && method === "GET") {
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
	}

	if (path === "/api/roles" && method === "POST") {
		const body = await readJson(request);
		const name = typeof body?.name === "string" ? body.name.trim() : "";
		const description = typeof body?.description === "string" ? body.description.trim() : "";
		const permissions = permissionList(body);
		if (!/^[a-z][a-z0-9:_-]{1,63}$/i.test(name)) {
			return json({ error: "invalid_name" }, 400);
		}
		try {
			const role = await db
				.prepare("INSERT INTO role (name, description) VALUES (?1, ?2) RETURNING id")
				.bind(name, description)
				.first<{ id: string }>();
			await setRolePermissions(db, role!.id, permissions);
			return json({ ok: true, id: role!.id });
		} catch (e) {
			if (isUniqueError(e)) return json({ error: "role_taken" }, 409);
			throw e;
		}
	}

	match = path.match(/^\/api\/roles\/([a-z0-9-]+)$/);
	if (match) {
		const id = match[1];
		const existing = await db
			.prepare("SELECT id, name, is_system FROM role WHERE id = ?1")
			.bind(id)
			.first<{ id: string; name: string; is_system: number }>();
		if (!existing) return json({ error: "not_found" }, 404);
		if (method === "PATCH") {
			const body = await readJson(request);
			const name = typeof body?.name === "string" ? body.name.trim() : existing.name;
			const description = typeof body?.description === "string" ? body.description.trim() : undefined;
			if (!/^[a-z][a-z0-9:_-]{1,63}$/i.test(name)) {
				return json({ error: "invalid_name" }, 400);
			}
			if (existing.is_system && name !== existing.name) {
				return json({ error: "builtin_role" }, 400);
			}
			try {
				if (description === undefined) {
					await db.prepare("UPDATE role SET name = ?1 WHERE id = ?2").bind(name, id).run();
				} else {
					await db
						.prepare("UPDATE role SET name = ?1, description = ?2 WHERE id = ?3")
						.bind(name, description, id)
						.run();
				}
			} catch (e) {
				if (isUniqueError(e)) return json({ error: "role_taken" }, 409);
				throw e;
			}
			const permissions = body?.permissions === undefined ? undefined : permissionList(body);
			if (permissions) await setRolePermissions(db, id, permissions);
			return json({ ok: true });
		}
		if (method === "DELETE") {
			if (existing.is_system) {
				return json({ error: "builtin_role" }, 400);
			}
			await db.batch([
				db.prepare("DELETE FROM role_permission WHERE role_id = ?1").bind(id),
				db.prepare("DELETE FROM user_role WHERE role_id = ?1").bind(id),
				db.prepare("DELETE FROM role WHERE id = ?1").bind(id),
			]);
			return json({ ok: true });
		}
	}

	/* Permissions ---------------------------------------------------- */

	if (path === "/api/permissions" && method === "GET") {
		const list = await db
			.prepare("SELECT id, code, description FROM permission ORDER BY code ASC")
			.all<PermissionRow>();
		return json({ permissions: list.results });
	}

	if (path === "/api/permissions" && method === "POST") {
		const body = await readJson(request);
		const code = typeof body?.code === "string" ? body.code.trim() : "";
		const description = typeof body?.description === "string" ? body.description.trim() : "";
		if (!/^[a-z][a-z0-9]*:[a-z][a-z0-9]*$/.test(code)) {
			return json({ error: "invalid_code" }, 400);
		}
		try {
			await db
				.prepare("INSERT INTO permission (code, description) VALUES (?1, ?2)")
				.bind(code, description)
				.run();
			return json({ ok: true });
		} catch (e) {
			if (isUniqueError(e)) return json({ error: "permission_taken" }, 409);
			throw e;
		}
	}

	match = path.match(/^\/api\/permissions\/([a-z0-9-]+)$/);
	if (match && method === "DELETE") {
		const id = match[1];
		await db.batch([
			db.prepare("DELETE FROM role_permission WHERE permission_id = ?1").bind(id),
			db.prepare("DELETE FROM permission WHERE id = ?1").bind(id),
		]);
		return json({ ok: true });
	}

	return json({ error: "not_found" }, 404);
}

function routePermission(path: string, method: string): string | null {
	if (path.match(/^\/api\/users\/([a-z0-9-]+)\/roles$/)) {
		// Assigning roles is authorization-granting and is governed by its own
		// permission, separate from editing user attributes.
		return "users:assign_roles";
	}
	if (path === "/api/users" || path.match(/^\/api\/users\/([a-z0-9-]+)$/)) {
		return method === "GET" ? "users:read" : "users:write";
	}
	if (path === "/api/roles" || path.match(/^\/api\/roles\/([a-z0-9-]+)$/)) {
		return method === "GET" ? "roles:read" : "roles:write";
	}
	if (path === "/api/permissions" || path.match(/^\/api\/permissions\/([a-z0-9-]+)$/)) {
		return method === "GET" ? "permissions:read" : "permissions:write";
	}
	return null;
}

/* ------------------------------------------------------------------ */
/* Auth helpers                                                        */
/* ------------------------------------------------------------------ */

async function authenticate(
	env: Env,
	request: Request,
): Promise<{ userId: string } | null> {
	const sessionId = getCookie(request, SESSION_COOKIE);
	if (!sessionId) return null;
	const session = await env.AUTH_DB.prepare(
		`SELECT user_id FROM admin_sessions
		WHERE id = ?1 AND expires_at > CURRENT_TIMESTAMP`,
	)
		.bind(sessionId)
		.first<{ user_id: string }>();
	return session ? { userId: session.user_id } : null;
}

async function verifyAccessToken(
	env: Env,
	token: string,
): Promise<AccessTokenPayload> {
	const storage = CloudflareStorage({
		namespace: env.AUTH_STORAGE as CloudflareStorageOptions["namespace"],
	});
	const keys = await signingKeys(storage);
	const jwks = createLocalJWKSet({
		keys: keys.map((k) => ({ ...k.jwk, alg: k.alg, use: "sig" })),
	});
	const { payload } = await jwtVerify(token, jwks);
	return payload as unknown as AccessTokenPayload;
}

async function hasPermission(
	env: Env,
	userId: string,
	permission: string,
): Promise<boolean> {
	const result = await env.AUTH_DB.prepare(
		`SELECT 1 FROM user_role ur
		JOIN role_permission rp ON rp.role_id = ur.role_id
		JOIN permission p ON p.id = rp.permission_id
		WHERE ur.user_id = ?1 AND p.code = ?2
		LIMIT 1`,
	)
		.bind(userId, permission)
		.first();
	return !!result;
}

async function getUserPermissionCodes(env: Env, userId: string): Promise<string[]> {
	const result = await env.AUTH_DB.prepare(
		`SELECT DISTINCT p.code FROM permission p
		JOIN role_permission rp ON rp.permission_id = p.id
		JOIN user_role ur ON ur.role_id = rp.role_id
		WHERE ur.user_id = ?1
		ORDER BY p.code`,
	)
		.bind(userId)
		.all<{ code: string }>();
	return result.results.map((r) => r.code);
}

/* ------------------------------------------------------------------ */
/* Database helpers                                                    */
/* ------------------------------------------------------------------ */

async function getOrCreateUser(env: Env, email: string): Promise<string> {
	const db = env.AUTH_DB;
	const allowlist = await getAdminAllowlist(env);
	let row = await db
		.prepare("SELECT id FROM user WHERE email = ?1")
		.bind(email)
		.first<{ id: string }>();
	if (!row) {
		// Registration gate: new users can only sign up while enabled.
		// Allowlisted admins are always allowed so the operator cannot be
		// locked out.
		if (!allowlist.includes(email.toLowerCase())) {
			const flag = await env.AUTH_STORAGE.get("config:registration");
			if (flag === "off") {
				throw new Error("registration_disabled");
			}
		}
		try {
			row = await db
				.prepare("INSERT INTO user (email) VALUES (?1) RETURNING id")
				.bind(email)
				.first<{ id: string }>();
		} catch (e) {
			if (isUniqueError(e)) {
				row = await db
					.prepare("SELECT id FROM user WHERE email = ?1")
					.bind(email)
					.first<{ id: string }>();
			} else {
				throw e;
			}
		}
		if (!row) throw new Error(`Unable to process user: ${email}`);
		// Every new user gets the default role.
		await db
			.prepare(
				"INSERT OR IGNORE INTO user_role (user_id, role_id) SELECT ?1, id FROM role WHERE name = 'user'",
			)
			.bind(row.id)
			.run();
	}
	// The ADMIN_EMAIL allowlist is the single source of truth for admins.
	// Membership is re-asserted on every login; removal from the list takes
	// effect the next time the user signs in (or when the role is revoked).
	if (allowlist.includes(email.toLowerCase())) {
		await db
			.prepare(
				"INSERT OR IGNORE INTO user_role (user_id, role_id) SELECT ?1, id FROM role WHERE name = 'admin'",
			)
			.bind(row.id)
			.run();
	}
	console.log(`Found or created user ${row.id} with email ${email}`);
	return row.id;
}

/**
 * Reads the admin email allowlist from the ADMIN_EMAIL binding (comma
 * separated). An unavailable or empty list means nobody is granted admin.
 */
async function getAdminAllowlist(env: Env): Promise<string[]> {
	try {
		const raw = await readSecret(env.ADMIN_EMAIL);
		return raw
			.split(",")
			.map((entry) => entry.trim().toLowerCase())
			.filter(Boolean);
	} catch (e) {
		console.warn(
			"ADMIN_EMAIL unavailable; no users will be granted admin: " +
				(e instanceof Error ? e.message : String(e)),
		);
		return [];
	}
}

async function getUserRoleNames(db: D1Database, userId: string): Promise<string[]> {
	const result = await db.prepare(
		`SELECT r.name FROM role r JOIN user_role ur ON ur.role_id = r.id
		WHERE ur.user_id = ?1 ORDER BY r.name`,
	)
		.bind(userId)
		.all<{ name: string }>();
	return result.results.map((r) => r.name);
}

async function isLastAdmin(
	db: D1Database,
	userId: string,
	newRoles?: string[],
): Promise<boolean> {
	const current = await getUserRoleNames(db, userId);
	if (!current.includes("admin")) return false;
	if (newRoles && newRoles.includes("admin")) return false;
	const other = await db
		.prepare(
			`SELECT 1 FROM user_role ur JOIN role r ON r.id = ur.role_id
			WHERE r.name = 'admin' AND ur.user_id != ?1 LIMIT 1`,
		)
		.bind(userId)
		.first();
	return !other;
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

function permissionList(body: any): string[] {
	return Array.isArray(body?.permissions)
		? body.permissions.filter((c: unknown) => typeof c === "string")
		: [];
}

/* ------------------------------------------------------------------ */
/* GitHub & misc helpers                                               */
/* ------------------------------------------------------------------ */

async function getGithubEmail(accessToken: string): Promise<string> {
	const response = await fetch("https://api.github.com/user/emails", {
		headers: {
			Authorization: `Bearer ${accessToken}`,
			Accept: "application/vnd.github+json",
			"User-Agent": "openauth-worker",
		},
	});
	if (!response.ok) {
		throw new Error(`Unable to fetch GitHub emails: ${response.status}`);
	}
	const emails = (await response.json()) as {
		email: string;
		primary: boolean;
		verified: boolean;
	}[];
	// Prefer the primary verified email, then any verified email.
	const primary = emails.find((e) => e.primary && e.verified) ?? emails.find((e) => e.verified);
	if (!primary) {
		throw new Error("No verified GitHub email available");
	}
	return primary.email;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function splitCsv(value: string | null | undefined): string[] {
	return value ? value.split(",").filter(Boolean) : [];
}

function isUniqueError(e: unknown): boolean {
	const message = e instanceof Error ? e.message : String(e);
	return message.includes("UNIQUE");
}

async function readJson(request: Request): Promise<any> {
	try {
		return await request.json();
	} catch {
		return null;
	}
}

function intParam(url: URL, name: string, fallback: number, min: number, max?: number): number {
	const parsed = parseInt(url.searchParams.get(name) ?? "", 10);
	let value = Number.isNaN(parsed) ? fallback : parsed;
	value = Math.max(min, value);
	if (max !== undefined) value = Math.min(max, value);
	return value;
}

function json(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "content-type": "application/json", "cache-control": "no-store" },
	});
}

function redirect(location: URL | string, cookies: string[] = []): Response {
	const headers = new Headers({ location: location.toString() });
	for (const c of cookies) headers.append("set-cookie", c);
	return new Response(null, { status: 302, headers });
}

function getCookie(request: Request, name: string): string | undefined {
	const header = request.headers.get("Cookie") ?? "";
	for (const part of header.split(/;\s*/)) {
		const eq = part.indexOf("=");
		if (eq > -1 && part.slice(0, eq).trim() === name) {
			return part.slice(eq + 1).trim();
		}
	}
	return undefined;
}

function setCookieValue(name: string, value: string, maxAge: number): string {
	return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function randomToken(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	return base64UrlEncode(bytes);
}


function base64UrlEncode(bytes: Uint8Array): string {
	let binary = "";
	for (const b of bytes) binary += String.fromCharCode(b);
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}