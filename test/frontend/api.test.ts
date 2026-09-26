import { afterEach, describe, expect, it, vi } from "vitest";
import { api, errorMessage, toDatetimeLocal } from "../../frontend/src/api";

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

describe("toDatetimeLocal — epoch → datetime-local input value in local time", () => {
	it("formats in the machine's local zone, minute precision, zero-padded", () => {
		// 2026-03-05T06:07:08.900Z is 14:07:08.900 in UTC+8.
		const epoch = Date.UTC(2026, 2, 5, 6, 7, 8, 900);
		// Shift the instant by the zone offset, then read it with UTC getters —
		// that yields the local wall-clock without depending on the host zone.
		const offset = new Date(epoch).getTimezoneOffset();
		const wall = new Date(epoch + -offset * 60_000);
		const pad = (n: number) => String(n).padStart(2, "0");
		const expected = `${wall.getUTCFullYear()}-${pad(wall.getUTCMonth() + 1)}-${pad(wall.getUTCDate())}T${pad(wall.getUTCHours())}:${pad(wall.getUTCMinutes())}`;
		expect(toDatetimeLocal(epoch)).toBe(expected);
		expect(toDatetimeLocal(epoch)).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
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

	it("surfaces the server requestId on 5xx failures for support lookup", async () => {
		vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(
			JSON.stringify({ error: "internal_error", requestId: "req_abc123" }),
			{ status: 500, headers: { "content-type": "application/json" } },
		))));
		await expect(api("/api/v1/overview")).rejects.toThrow("req_abc123");
	});

	it("keeps content-type on body-less DELETEs (session revocation hits auth endpoints)", async () => {
		const calls: { url: string; init: RequestInit }[] = [];
		stubFetch(calls);
		await api("/api/v1/applications/app_1", { method: "DELETE" });
		expect(calls[0].init.body).toBeUndefined();
		expect(headerOf(calls[0].init, "content-type")).toBe("application/json");
	});
});
