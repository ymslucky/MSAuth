import { SELF } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import {
	api,
	applyMigrations,
	CookieJar,
	registerUserViaPassword,
	ORIGIN,
} from "./helpers";

let admin: CookieJar;
let user: CookieJar;

beforeAll(async () => {
	await applyMigrations();
	admin = await registerUserViaPassword("root@example.com", "password123");
	user = await registerUserViaPassword("member@example.com", "password123");
	// Fixture used by role assignment tests; recreated per test file because
	// storage is isolated between files.
	const res = await api(admin, "/api/roles", {
		method: "POST",
		body: { name: "editor", description: "Read-only access", permissions: ["users:read"] },
	});
	if (res.status !== 200) throw new Error("failed to create editor fixture");
});

describe("management API authorization", () => {
	it("rejects unauthenticated requests", async () => {
		const res = await SELF.fetch(ORIGIN + "/api/users", { redirect: "manual" });
		expect(res.status).toBe(401);
	});

	it("rejects requests from users without the required permission", async () => {
		const res = await api(user, "/api/users");
		expect(res.status).toBe(403);
	});

	it("lets any signed-in user inspect their own identity", async () => {
		const res = await api(user, "/api/me");
		expect(res.status).toBe(200);
		const me = (await res.json()) as { user: { email: string }; permissions: string[] };
		expect(me.user.email).toBe("member@example.com");
		expect(me.permissions).toEqual([]);
	});
});

describe("user management", () => {
	it("lists users with pagination metadata", async () => {
		const res = await api(admin, "/api/users?page=1&pageSize=2");
		expect(res.status).toBe(200);
		const data = (await res.json()) as {
			users: { email: string; roles: string[] }[];
			total: number;
			page: number;
			pageSize: number;
		};
		expect(data.total).toBeGreaterThanOrEqual(2);
		expect(data.users).toHaveLength(2);
		expect(data.page).toBe(1);
		expect(data.pageSize).toBe(2);
	});

	it("searches users by email", async () => {
		const res = await api(admin, "/api/users?q=member");
		expect(res.status).toBe(200);
		const data = (await res.json()) as { users: { email: string }[]; total: number };
		expect(data.total).toBe(1);
		expect(data.users[0]?.email).toBe("member@example.com");
	});

	it("updates a user email", async () => {
		// Create a dedicated user through the API-visible list.
		const list = await api(admin, "/api/users?q=member");
		const data = (await list.json()) as { users: { id: string }[] };
		const id = data.users[0]!.id;

		const res = await api(admin, "/api/users/" + id, {
			method: "PATCH",
			body: { email: "renamed@example.com" },
		});
		expect(res.status).toBe(200);

		// Rename back so other tests keep using member@example.com.
		const restore = await api(admin, "/api/users/" + id, {
			method: "PATCH",
			body: { email: "member@example.com" },
		});
		expect(restore.status).toBe(200);
	});

	it("rejects duplicate emails with 409", async () => {
		const list = await api(admin, "/api/users?q=member");
		const data = (await list.json()) as { users: { id: string }[] };
		const id = data.users[0]!.id;

		const res = await api(admin, "/api/users/" + id, {
			method: "PATCH",
			body: { email: "root@example.com" },
		});
		expect(res.status).toBe(409);
	});

	it("rejects invalid emails with 400", async () => {
		const list = await api(admin, "/api/users?q=member");
		const data = (await list.json()) as { users: { id: string }[] };
		const id = data.users[0]!.id;

		const res = await api(admin, "/api/users/" + id, {
			method: "PATCH",
			body: { email: "not-an-email" },
		});
		expect(res.status).toBe(400);
	});

	it("prevents deleting yourself", async () => {
		const list = await api(admin, "/api/users?q=root@");
		const data = (await list.json()) as { users: { id: string }[] };
		const id = data.users[0]!.id;

		const res = await api(admin, "/api/users/" + id, { method: "DELETE" });
		expect(res.status).toBe(400);
	});

	it("prevents removing the last admin via role assignment", async () => {
		const list = await api(admin, "/api/users?q=root@");
		const data = (await list.json()) as { users: { id: string }[] };
		const id = data.users[0]!.id;

		const res = await api(admin, "/api/users/" + id + "/roles", {
			method: "PUT",
			body: { roles: ["user"] },
		});
		expect(res.status).toBe(400);
	});

	it("assigns and replaces roles for a user", async () => {
		const list = await api(admin, "/api/users?q=member");
		const data = (await list.json()) as { users: { id: string }[] };
		const id = data.users[0]!.id;

		const put = await api(admin, "/api/users/" + id + "/roles", {
			method: "PUT",
			body: { roles: ["user", "editor"] },
		});
		expect(put.status).toBe(200);

		const detail = await api(admin, "/api/users/" + id);
		const detailData = (await detail.json()) as { roles: string[] };
		expect(detailData.roles.sort()).toEqual(["editor", "user"]);
	});

	it("rejects unknown roles", async () => {
		const list = await api(admin, "/api/users?q=member");
		const data = (await list.json()) as { users: { id: string }[] };
		const id = data.users[0]!.id;

		const res = await api(admin, "/api/users/" + id + "/roles", {
			method: "PUT",
			body: { roles: ["nonexistent"] },
		});
		expect(res.status).toBe(400);
	});

	it("deletes a regular user", async () => {
		// Register a disposable user via the public flow, then delete it.
		const temp = await registerUserViaPassword("temp@example.com", "password123");
		expect(temp.has("__Host-admin_session")).toBe(true);
		const list = await api(admin, "/api/users?q=temp@");
		const data = (await list.json()) as { users: { id: string }[] };
		const id = data.users[0]!.id;

		const res = await api(admin, "/api/users/" + id, { method: "DELETE" });
		expect(res.status).toBe(200);

		const gone = await api(admin, "/api/users/" + id);
		expect(gone.status).toBe(404);
	});
});

describe("role management", () => {
	it("lists roles with permissions and user counts", async () => {
		const res = await api(admin, "/api/roles");
		expect(res.status).toBe(200);
		const data = (await res.json()) as {
			roles: { name: string; permissions: string[]; user_count: number }[];
		};
		const adminRole = data.roles.find((r) => r.name === "admin");
		expect(adminRole).toBeTruthy();
		expect(adminRole!.permissions).toContain("users:write");
		expect(adminRole!.user_count).toBeGreaterThanOrEqual(1);
	});

	it("creates a role with permissions", async () => {
		const res = await api(admin, "/api/roles", {
			method: "POST",
			body: {
				name: "auditor",
				description: "Can audit users",
				permissions: ["users:read"],
			},
		});
		expect(res.status).toBe(200);
	});

	it("rejects duplicate role names with 409", async () => {
		const res = await api(admin, "/api/roles", {
			method: "POST",
			body: { name: "editor", description: "", permissions: [] },
		});
		expect(res.status).toBe(409);
	});

	it("rejects invalid role names with 400", async () => {
		const res = await api(admin, "/api/roles", {
			method: "POST",
			body: { name: "", description: "", permissions: [] },
		});
		expect(res.status).toBe(400);
	});

	it("updates a role name and permissions", async () => {
		const list = await api(admin, "/api/roles");
		const data = (await list.json()) as { roles: { id: string; name: string }[] };
		const editor = data.roles.find((r) => r.name === "editor")!;

		const res = await api(admin, "/api/roles/" + editor.id, {
			method: "PATCH",
			body: { description: "Read-only access", permissions: ["users:read", "roles:read"] },
		});
		expect(res.status).toBe(200);

		const after = await api(admin, "/api/roles");
		const afterData = (await after.json()) as {
			roles: { id: string; permissions: string[] }[];
		};
		const updated = afterData.roles.find((r) => r.id === editor.id)!;
		expect(updated.permissions.sort()).toEqual(["roles:read", "users:read"]);
	});

	it("rejects deleting built-in roles", async () => {
		const list = await api(admin, "/api/roles");
		const data = (await list.json()) as { roles: { id: string; name: string }[] };
		const adminRole = data.roles.find((r) => r.name === "admin")!;

		const res = await api(admin, "/api/roles/" + adminRole.id, { method: "DELETE" });
		expect(res.status).toBe(400);
	});

	it("deletes a custom role", async () => {
		const list = await api(admin, "/api/roles");
		const data = (await list.json()) as { roles: { id: string; name: string }[] };
		const editor = data.roles.find((r) => r.name === "editor")!;

		const res = await api(admin, "/api/roles/" + editor.id, { method: "DELETE" });
		expect(res.status).toBe(200);

		const after = await api(admin, "/api/roles");
		const afterData = (await after.json()) as { roles: { name: string }[] };
		expect(afterData.roles.find((r) => r.name === "editor")).toBeUndefined();
	});
});

describe("permission management", () => {
	it("lists permissions", async () => {
		const res = await api(admin, "/api/permissions");
		expect(res.status).toBe(200);
		const data = (await res.json()) as { permissions: { code: string }[] };
		expect(data.permissions.length).toBeGreaterThanOrEqual(6);
	});

	it("creates a permission", async () => {
		const res = await api(admin, "/api/permissions", {
			method: "POST",
			body: { code: "settings:write", description: "Manage settings" },
		});
		expect(res.status).toBe(200);
	});

	it("rejects duplicate permission codes with 409", async () => {
		const res = await api(admin, "/api/permissions", {
			method: "POST",
			body: { code: "settings:write", description: "" },
		});
		expect(res.status).toBe(409);
	});

	it("rejects malformed permission codes with 400", async () => {
		const res = await api(admin, "/api/permissions", {
			method: "POST",
			body: { code: "not-a-permission", description: "" },
		});
		expect(res.status).toBe(400);
	});

	it("deletes a permission", async () => {
		const list = await api(admin, "/api/permissions");
		const data = (await list.json()) as { permissions: { id: string; code: string }[] };
		const permission = data.permissions.find((p) => p.code === "settings:write")!;

		const res = await api(admin, "/api/permissions/" + permission.id, {
			method: "DELETE",
		});
		expect(res.status).toBe(200);

		const after = await api(admin, "/api/permissions");
		const afterData = (await after.json()) as { permissions: { code: string }[] };
		expect(afterData.permissions.find((p) => p.code === "settings:write")).toBeUndefined();
	});
});