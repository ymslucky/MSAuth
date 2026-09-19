import { beforeAll, describe, expect, it } from "vitest";
import {
	api,
	applyMigrations,
	CookieJar,
	createTestSession,
} from "./helpers";

let admin: CookieJar;
let member: CookieJar;

beforeAll(async () => {
	await applyMigrations();
	admin = await createTestSession("root@example.com", ["admin", "user"]);
	member = await createTestSession("member@example.com", ["user"]);
});

describe("audit log", () => {
	it("records user email updates", async () => {
		const list = await api(admin, "/api/users?q=member");
		const data = (await list.json()) as { users: { id: string }[] };
		const id = data.users[0]!.id;

		const res = await api(admin, "/api/users/" + id, {
			method: "PATCH",
			body: { email: "renamed@example.com" },
		});
		expect(res.status).toBe(200);

		const audit = await api(admin, "/api/audit");
		const data2 = (await audit.json()) as {
			entries: { actor_email: string; action: string; target_id: string }[];
		};
		const entry = data2.entries.find(
			(e) => e.action === "user.update" && e.target_id === id,
		);
		expect(entry).toBeTruthy();
		expect(entry!.actor_email).toBe("root@example.com");
	});

	it("records role assignments", async () => {
		const list = await api(admin, "/api/users?q=renamed");
		const data = (await list.json()) as { users: { id: string }[] };
		const id = data.users[0]!.id;

		await api(admin, "/api/users/" + id + "/roles", {
			method: "PUT",
			body: { roles: ["user"] },
		});

		const audit = await api(admin, "/api/audit");
		const data2 = (await audit.json()) as { entries: { action: string }[] };
		expect(data2.entries.some((e) => e.action === "user.assign_roles")).toBe(true);
	});

	it("requires the audit:read permission", async () => {
		const res = await api(member, "/api/audit");
		expect(res.status).toBe(403);
	});

	it("lists audit entries newest first for admins", async () => {
		const res = await api(admin, "/api/audit");
		expect(res.status).toBe(200);
		const data = (await res.json()) as {
			entries: { created_at: string }[];
		};
		expect(data.entries.length).toBeGreaterThanOrEqual(2);
		const times = data.entries.map((e) => e.created_at);
		const sorted = [...times].sort().reverse();
		expect(times).toEqual(sorted);
	});
});