import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../../frontend/src/api";

function stubFetch(calls: { url: string; init: RequestInit }[]) {
	vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
		calls.push({ url: String(input), init: init ?? {} });
		return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } }));
	}));
}

function headerOf(init: RequestInit, name: string): string | null {
	return new Headers(init.headers).get(name);
}

describe("api fetch wrapper", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("omits content-type on body-less POSTs — Better Auth rejects empty JSON bodies with 400", async () => {
		const calls: { url: string; init: RequestInit }[] = [];
		stubFetch(calls);
		await api("/api/auth/sign-out", { method: "POST" });
		expect(calls).toHaveLength(1);
		expect(calls[0].init.body).toBeUndefined();
		expect(headerOf(calls[0].init, "content-type")).toBeNull();
	});

	it("still sends application/json when a body is present", async () => {
		const calls: { url: string; init: RequestInit }[] = [];
		stubFetch(calls);
		await api("/api/auth/sign-in/email", { method: "POST", body: JSON.stringify({ email: "a@b.c" }) });
		expect(headerOf(calls[0].init, "content-type")).toBe("application/json");
		expect(calls[0].init.body).not.toBeNull();
	});
});
