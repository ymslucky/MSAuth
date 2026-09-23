import { describe, expect, it } from "vitest";
import { RESOURCE_TONES, resourceTone } from "../../frontend/src/ui";

describe("resourceTone — finite resourceType → tone map", () => {
	it("maps every backend resourceType onto its tone", () => {
		expect(resourceTone("agent")).toBe("agent");
		expect(resourceTone("delegation")).toBe("delegation");
		expect(resourceTone("key")).toBe("apikey");
		expect(resourceTone("user")).toBe("user");
		expect(resourceTone("session")).toBe("session");
		expect(resourceTone("domain")).toBe("domain");
		expect(resourceTone("alert")).toBe("alert");
		expect(resourceTone("resource")).toBe("resource");
		expect(resourceTone("application")).toBe("client");
		expect(resourceTone("platform")).toBe("other");
	});

	it("falls back to the neutral tone for unknown types", () => {
		expect(resourceTone("widget")).toBe("other");
		expect(resourceTone("")).toBe("other");
	});

	it("exposes exactly the finite tone vocabulary", () => {
		expect([...RESOURCE_TONES].sort()).toEqual([
			"agent",
			"alert",
			"apikey",
			"client",
			"delegation",
			"domain",
			"other",
			"resource",
			"session",
			"user",
		]);
	});
});
