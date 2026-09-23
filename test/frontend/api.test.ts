import { afterEach, describe, expect, it, vi } from "vitest";
import { api, errorMessage } from "../../frontend/src/api";

function stubFetch(calls: { url: string; init: RequestInit }[]) {
	vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
		calls.push({ url: String(input), init: init ?? {} });
		return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } }));
	}));
}

function headerOf(init: RequestInit, name: string): string | null {
	return new Headers(init.headers).get(name);
}

describe("errorMessage — the one failure-surfacing helper every page renders", () => {
	it("unwraps Error instances", () => {
		expect(errorMessage(new Error("boom"))).toBe("boom");
	});

	it("stringifies non-Error throwables", () => {
		expect(errorMessage("plain")).toBe("plain");
		expect(errorMessage(42)).toBe("42");
	});
});

describe("api fetch wrapper", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("body-less POSTs default to a JSON object — Better Auth rejects empty bodies (400) and missing content-type (415)", async () => {
		const calls: { url: string; init: RequestInit }[] = [];
		stubFetch(calls);
		await api("/api/auth/sign-out", { method: "POST" });
		expect(calls[0].init.body).toBe("{}");
		expect(headerOf(calls[0].init, "content-type")).toBe("application/json");
	});

	it("sends the caller's body untouched alongside the JSON content-type", async () => {
		const calls: { url: string; init: RequestInit }[] = [];
		stubFetch(calls);
		await api("/api/auth/sign-in/email", { method: "POST", body: JSON.stringify({ email: "a@b.c" }) });
		expect(headerOf(calls[0].init, "content-type")).toBe("application/json");
		expect(calls[0].init.body).toBe(JSON.stringify({ email: "a@b.c" }));
	});

	it("keeps content-type on body-less DELETEs (session revocation hits auth endpoints)", async () => {
		const calls: { url: string; init: RequestInit }[] = [];
		stubFetch(calls);
		await api("/api/v1/applications/app_1", { method: "DELETE" });
		expect(calls[0].init.body).toBeUndefined();
		expect(headerOf(calls[0].init, "content-type")).toBe("application/json");
	});
});
