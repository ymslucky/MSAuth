import { describe, expect, it } from "vitest";
import { validatePasswordChange } from "../../frontend/src/account";

describe("validatePasswordChange — Better Auth default policy (min 8) + confirmation", () => {
	it("rejects passwords shorter than 8 characters", () => {
		expect(validatePasswordChange("aB3$de1", "aB3$de1")).toBe("short");
		expect(validatePasswordChange("", "x")).toBe("short");
	});

	it("rejects a mismatched confirmation", () => {
		expect(validatePasswordChange("correct horse battery", "correct horse battery 2")).toBe("mismatch");
	});

	it("accepts exactly 8 characters and matching confirmation", () => {
		expect(validatePasswordChange("aB3$de12", "aB3$de12")).toBeNull();
	});
});
