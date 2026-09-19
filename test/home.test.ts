import { SELF } from "cloudflare:test";
import { expect, it } from "vitest";
import { ORIGIN } from "./helpers";

it("serves a homepage at /", async () => {
	const res = await SELF.fetch(ORIGIN + "/", { redirect: "manual" });
	expect(res.status).toBe(200);
	expect(res.headers.get("content-type")).toContain("text/html");
	const html = await res.text();
	expect(html).toContain("MSAuth");
	expect(html).toContain("/admin/login");
});

it("sends security headers and a strict CSP without scripts", async () => {
	const res = await SELF.fetch(ORIGIN + "/");
	const csp = res.headers.get("content-security-policy") ?? "";
	expect(csp).toContain("default-src 'none'");
	expect(csp).toContain("frame-ancestors 'none'");
	expect(res.headers.get("x-frame-options")).toBe("DENY");
	const html = await res.text();
	// The homepage is fully static: no scripts at all.
	expect(html).not.toContain("<script");
});

it("never reflects query parameters (no legacy demo echo)", async () => {
	const res = await SELF.fetch(ORIGIN + "/?code=SECRET&state=x");
	const body = await res.text();
	expect(body).not.toContain("SECRET");
	expect(res.status).toBe(200);
});