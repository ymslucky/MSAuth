import { describe, expect, it } from "vitest";
import { isOperatorOnly, OPERATOR_ONLY_PATHS, operatorOnlyPathGuard, visibleSections } from "../../frontend/src/consoleNav";

const NAV = [
	{ group: "", items: [{ label: "Overview", to: "/" }] },
	{
		group: "Developer",
		items: [{ label: "Applications", to: "/applications" }, { label: "Keys", to: "/keys" }],
	},
	{
		group: "Platform",
		items: [
			{ label: "Users", to: "/users" },
			{ label: "Settings", to: "/settings" },
			{ label: "Domains", to: "/domains" },
		],
	},
];

describe("consoleNav — operator-only menu filtering", () => {
	it("matches the backend requireOperator surface exactly", () => {
		// governance.ts guards /users (and subpaths) and /settings; alerts and
		// domains are user-scoped and stay visible to everyone.
		expect(OPERATOR_ONLY_PATHS).toEqual(["/users", "/settings"]);
	});

	it("hides operator-only entries from plain users, keeping their groups", () => {
		const sections = visibleSections(NAV, false);
		const paths = sections.flatMap(section => section.items.map(item => item.to));
		expect(paths).toEqual(["/", "/applications", "/keys", "/domains"]);
		// the Platform group survives because Domains is still visible
		expect(sections.map(section => section.group)).toEqual(["", "Developer", "Platform"]);
	});

	it("never filters anything for operators", () => {
		const full = NAV.flatMap(section => section.items.map(item => item.to));
		expect(visibleSections(NAV, true).flatMap(section => section.items.map(item => item.to)))
			.toEqual(full);
		expect(isOperatorOnly("/users")).toBe(true);
	});

	it("recognizes operator-only detail paths and guards plain users only", () => {
		expect(isOperatorOnly("/users/some-id")).toBe(true);
		expect(isOperatorOnly("/settings")).toBe(true);
		expect(isOperatorOnly("/alerts")).toBe(false);
		expect(isOperatorOnly("/domains")).toBe(false);
		expect(isOperatorOnly("/userships")).toBe(false); // prefix must not over-match

		expect(operatorOnlyPathGuard("/users", false)).toBe(true);
		expect(operatorOnlyPathGuard("/users/abc", false)).toBe(true);
		expect(operatorOnlyPathGuard("/users", true)).toBe(false);
		expect(operatorOnlyPathGuard("/overview", false)).toBe(false);
	});
});
