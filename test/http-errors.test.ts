import { SELF } from "cloudflare:test";
import { beforeAll, expect, it } from "vitest";
import { applyMigrations, ORIGIN } from "./helpers";

beforeAll(async () => {
	await applyMigrations();
});

it("serves a sketch 404 page for unknown top-level paths", async () => {
	const res = await SELF.fetch(ORIGIN + "/nonexistent-page", { redirect: "manual" });
	expect(res.status).toBe(404);
	expect(res.headers.get("content-type")).toContain("text/html");
	const html = await res.text();
	expect(html).toContain("页面不存在");
	expect(html).toContain("返回主页");
});

it("returns 404 for unknown api paths without auth", async () => {
	const res = await SELF.fetch(ORIGIN + "/api/unknown", { redirect: "manual" });
	expect(res.status).toBe(404);
});
