import { describe, expect, it } from "vitest";
import { tAction, zh } from "../../frontend/src/i18n";

// Every audit action code the backend can emit (grep auditStatement/audit in src/).
const BACKEND_ACTION_CODES = [
	// src/iam/agents.ts
	"agent.created",
	"agent.revoked",
	"delegation.created",
	"delegation.revoked",
	// src/agent/exchange.ts
	"token.exchanged",
	// src/iam/governance.ts
	"user.suspended",
	"user.unsuspended",
	"session.revoked",
	"settings.updated",
	"domain.added",
	"domain.verified",
	// src/iam/developers.ts
	"application.created",
	"application.updated",
	"application.deleted",
	"application.secret_rotated",
	"registration.revoked",
	"key.created",
	"key.revoked",
	"resource.created",
	"resource.linked",
];

describe("tAction — audit action labels", () => {
	it("translates every backend action code into Chinese", () => {
		for (const code of BACKEND_ACTION_CODES) {
			const label = tAction(code);
			expect(label, code).not.toBe(code);
			expect(label, code).toMatch(/[\u4e00-\u9fff]/);
		}
	});

	it("keys every code in the zh dict so EN mode degrades to the raw code", () => {
		for (const code of BACKEND_ACTION_CODES) {
			expect(zh[code], code).toBeTruthy();
		}
	});

	it("falls back to the raw code for unknown actions (log correlation)", () => {
		expect(tAction("future.thing")).toBe("future.thing");
		expect(tAction("")).toBe("");
	});
});
