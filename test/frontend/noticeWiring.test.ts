import { describe, expect, it } from "vitest";
import applicationsSource from "../../frontend/src/pages/console/Applications.tsx?raw";
import agentsSource from "../../frontend/src/pages/console/Agents.tsx?raw";
import alertsSource from "../../frontend/src/pages/console/Alerts.tsx?raw";
import delegationsSource from "../../frontend/src/pages/console/Delegations.tsx?raw";
import domainsSource from "../../frontend/src/pages/console/Domains.tsx?raw";
import keysSource from "../../frontend/src/pages/console/Keys.tsx?raw";
import resourcesSource from "../../frontend/src/pages/console/Resources.tsx?raw";
import sessionsSource from "../../frontend/src/pages/console/Sessions.tsx?raw";
import settingsSource from "../../frontend/src/pages/console/Settings.tsx?raw";
import userDetailSource from "../../frontend/src/pages/console/UserDetail.tsx?raw";
import usersSource from "../../frontend/src/pages/console/Users.tsx?raw";

/**
 * The notice system (notice-ui.tsx) is the designed feedback channel: toast
 * for mutation outcomes, in-place errors only for data loading. These tests
 * pin the wiring so pages cannot quietly regress to ad-hoc feedback.
 */

// Pages that mutate data must be wired to the notice system. Read-only pages
// (Audit, Overview), the layout shell (Console) and the demo catalog are exempt.
const mutatingPages: Array<[string, string]> = [
	["Applications", applicationsSource],
	["Agents", agentsSource],
	["Alerts", alertsSource],
	["Delegations", delegationsSource],
	["Domains", domainsSource],
	["Keys", keysSource],
	["Resources", resourcesSource],
	["Sessions", sessionsSource],
	["Settings", settingsSource],
	["UserDetail", userDetailSource],
	["Users", usersSource],
];

// Success copy lives in the dict's toasts section — every key must actually
// fire from a page, or the message is designed-but-dead.
const successKeys = [
	"Application created.",
	"Application updated.",
	"Client secret rotated.",
	"Application deleted.",
	"API key created.",
	"API key revoked.",
	"Resource registered.",
	"Client linked to resource.",
	"Agent registered.",
	"Agent revoked.",
	"Delegation granted.",
	"Delegation revoked.",
	"Session revoked.",
	"Alert acknowledged.",
	"User suspended.",
	"User unsuspended.",
	"Settings saved.",
	"Domain added.",
	"Domain verified.",
];

describe("notice system wiring contract", () => {
	it("wires every mutating console page to useNotice()", () => {
		const unwired = mutatingPages
			.filter(([, source]) => !source.includes("useNotice()"))
			.map(([name]) => name);
		expect(unwired).toEqual([]);
	});

	it("fires every designed success message from a real page", () => {
		const all = mutatingPages.map(([, source]) => source).join("\n");
		const dead = successKeys.filter(key => !all.includes(`t("${key}")`));
		expect(dead).toEqual([]);
	});

	it("routes mutation failures through error toasts, not inline notes", () => {
		// One setError(errorMessage(cause)) is allowed per page — the list-load
		// catch, rendered in-place by ErrorState. Any second occurrence means a
		// mutation handler is bypassing the notice system.
		const violators = mutatingPages
			.filter(([, source]) => source.split("setError(errorMessage(cause))").length - 1 > 1)
			.map(([name]) => name);
		expect(violators).toEqual([]);
	});
});
