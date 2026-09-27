import { describe, expect, it, vi, afterEach } from "vitest";
import { consumeReturnTo, rememberReturnTo, resolveGate, safeReturnTo } from "../../frontend/src/gate";

describe("resolveGate", () => {
	it("never routes an unauthenticated visitor into the console", () => {
		expect(resolveGate("/", false)).toBe("login");
		expect(resolveGate("/applications", false)).toBe("login");
		expect(resolveGate("/agents", false)).toBe("login");
	});

	it("keeps authenticated visitors in the console and consent flows", () => {
		expect(resolveGate("/", true)).toBe("console");
		expect(resolveGate("/keys", true)).toBe("console");
		expect(resolveGate("/consent", true)).toBe("consent");
	});

	it("always allows the login page and bounces unauthenticated consent there", () => {
		expect(resolveGate("/login", false)).toBe("login");
		expect(resolveGate("/login", true)).toBe("login");
		expect(resolveGate("/consent", false)).toBe("login");
	});

	it("serves the public docs page with or without a session", () => {
		expect(resolveGate("/docs", false)).toBe("docs");
		expect(resolveGate("/docs", true)).toBe("docs");
		expect(resolveGate("/docs/integration", false)).toBe("docs");
		expect(resolveGate("/docs/integration", true)).toBe("docs");
	});
});

describe("post-login deep links (returnTo)", () => {
	afterEach(() => vi.unstubAllGlobals());

	function stubSessionStorage() {
		const store = new Map<string, string>();
		vi.stubGlobal("sessionStorage", {
			getItem: (key: string) => store.get(key) ?? null,
			setItem: (key: string, value: string) => void store.set(key, value),
			removeItem: (key: string) => void store.delete(key),
		});
		return store;
	}

	it("only same-origin absolute paths survive sanitization", () => {
		expect(safeReturnTo("/applications?x=1")).toBe("/applications?x=1");
		expect(safeReturnTo("/")).toBe("/");
		expect(safeReturnTo("//evil.test/steal")).toBeNull();
		expect(safeReturnTo("https://evil.test")).toBeNull();
		expect(safeReturnTo("/\\evil.test")).toBeNull();
		expect(safeReturnTo("")).toBeNull();
		expect(safeReturnTo(null)).toBeNull();
		expect(safeReturnTo(undefined)).toBeNull();
	});

	it("remembers deep links but never login, docs or consent", () => {
		const store = stubSessionStorage();
		rememberReturnTo("/applications", "");
		expect(store.get("msauth-returnto")).toBe("/applications");
		rememberReturnTo("/keys", "?filter=revoked");
		expect(store.get("msauth-returnto")).toBe("/keys?filter=revoked");
		rememberReturnTo("/login", "");
		expect(store.get("msauth-returnto")).toBe("/keys?filter=revoked");
		rememberReturnTo("/docs", "");
		expect(store.get("msauth-returnto")).toBe("/keys?filter=revoked");
		rememberReturnTo("/consent", "?sig=x");
		expect(store.get("msauth-returnto")).toBe("/keys?filter=revoked");
	});

	it("consuming returns the link once and clears it", () => {
		stubSessionStorage();
		rememberReturnTo("/audit?page=2", "");
		expect(consumeReturnTo()).toBe("/audit?page=2");
		expect(consumeReturnTo()).toBeNull();
	});

	it("a poisoned capture attempt never replaces the deep link", () => {
		stubSessionStorage();
		rememberReturnTo("/applications", "");
		// protocol-relative captures are refused at write time
		rememberReturnTo("//evil.test", "");
		expect(consumeReturnTo()).toBe("/applications");
	});
});
