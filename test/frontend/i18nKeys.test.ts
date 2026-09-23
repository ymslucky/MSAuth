import { describe, expect, it } from "vitest";
import { zh } from "../../frontend/src/dict";
import uiSource from "../../frontend/src/ui.tsx?raw";
import dialogSource from "../../frontend/src/dialog.tsx?raw";
import noticeSource from "../../frontend/src/notice-ui.tsx?raw";
import paletteSource from "../../frontend/src/palette-ui.tsx?raw";
import themeSource from "../../frontend/src/theme.tsx?raw";
import loginSource from "../../frontend/src/pages/Login.tsx?raw";
import consentSource from "../../frontend/src/pages/Consent.tsx?raw";
import docsSource from "../../frontend/src/pages/Docs.tsx?raw";
import consoleSource from "../../frontend/src/pages/console/Console.tsx?raw";
import overviewSource from "../../frontend/src/pages/console/Overview.tsx?raw";
import catalogSource from "../../frontend/src/pages/console/Catalog.tsx?raw";
import applicationsSource from "../../frontend/src/pages/console/Applications.tsx?raw";
import keysSource from "../../frontend/src/pages/console/Keys.tsx?raw";
import resourcesSource from "../../frontend/src/pages/console/Resources.tsx?raw";
import agentsSource from "../../frontend/src/pages/console/Agents.tsx?raw";
import delegationsSource from "../../frontend/src/pages/console/Delegations.tsx?raw";
import auditSource from "../../frontend/src/pages/console/Audit.tsx?raw";
import sessionsSource from "../../frontend/src/pages/console/Sessions.tsx?raw";
import alertsSource from "../../frontend/src/pages/console/Alerts.tsx?raw";
import usersSource from "../../frontend/src/pages/console/Users.tsx?raw";
import userDetailSource from "../../frontend/src/pages/console/UserDetail.tsx?raw";
import settingsSource from "../../frontend/src/pages/console/Settings.tsx?raw";
import domainsSource from "../../frontend/src/pages/console/Domains.tsx?raw";

/** Every module that renders copy through t(). Keep in sync with the file tree. */
const SOURCES: Record<string, string> = {
	"ui.tsx": uiSource,
	"dialog.tsx": dialogSource,
	"notice-ui.tsx": noticeSource,
	"palette-ui.tsx": paletteSource,
	"theme.tsx": themeSource,
	"pages/Login.tsx": loginSource,
	"pages/Consent.tsx": consentSource,
	"pages/Docs.tsx": docsSource,
	"pages/console/Console.tsx": consoleSource,
	"pages/console/Overview.tsx": overviewSource,
	"pages/console/Catalog.tsx": catalogSource,
	"pages/console/Applications.tsx": applicationsSource,
	"pages/console/Keys.tsx": keysSource,
	"pages/console/Resources.tsx": resourcesSource,
	"pages/console/Agents.tsx": agentsSource,
	"pages/console/Delegations.tsx": delegationsSource,
	"pages/console/Audit.tsx": auditSource,
	"pages/console/Sessions.tsx": sessionsSource,
	"pages/console/Alerts.tsx": alertsSource,
	"pages/console/Users.tsx": usersSource,
	"pages/console/UserDetail.tsx": userDetailSource,
	"pages/console/Settings.tsx": settingsSource,
	"pages/console/Domains.tsx": domainsSource,
};

const T_LITERAL = /\bt\("((?:[^"\\]|\\.)*)"/g;

/** Collect literal `t("…")` keys from a module's source text. */
export function extractKeys(source: string): string[] {
	return [...source.matchAll(T_LITERAL)].map(match => match[1]);
}

describe("i18n — every t(\"…\") call resolves in the zh dict", () => {
	it("walks every t()-calling module and finds no missing key", () => {
		const missing: string[] = [];
		for (const [file, source] of Object.entries(SOURCES)) {
			for (const key of extractKeys(source)) {
				if (!(key in zh)) missing.push(`${file}: ${key}`);
			}
		}
		expect(missing).toEqual([]);
	});

	it("actually scanned a meaningful number of call sites (guards against a silent regex miss)", () => {
		const total = Object.values(SOURCES).reduce((sum, source) => sum + extractKeys(source).length, 0);
		expect(total).toBeGreaterThan(200);
	});
});
