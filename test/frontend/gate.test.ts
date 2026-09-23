import { describe, expect, it } from "vitest";
import { resolveGate } from "../../frontend/src/gate";

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
