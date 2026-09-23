import { describe, expect, it } from "vitest";
import {
	LEDGER_PALETTES,
	SCENE_PALETTES,
	THEME_STORAGE_KEY,
	isThemeChoice,
	ledgerPalette,
	resolveTheme,
	scenePalette,
	themeChoices,
} from "../../frontend/src/theme";

describe("resolveTheme — stored choice wins over the system", () => {
	it("passes an explicit light/dark choice through regardless of the system", () => {
		expect(resolveTheme("light", true)).toBe("light");
		expect(resolveTheme("light", false)).toBe("light");
		expect(resolveTheme("dark", false)).toBe("dark");
		expect(resolveTheme("dark", true)).toBe("dark");
	});

	it("follows the live system preference on auto", () => {
		expect(resolveTheme("auto", true)).toBe("dark");
		expect(resolveTheme("auto", false)).toBe("light");
	});
});

describe("isThemeChoice — invalid stored values collapse to auto", () => {
	it("accepts exactly the three-state control values", () => {
		expect(isThemeChoice("auto")).toBe(true);
		expect(isThemeChoice("light")).toBe(true);
		expect(isThemeChoice("dark")).toBe(true);
	});

	it("rejects anything else a stale client may have stored", () => {
		expect(isThemeChoice("system")).toBe(false);
		expect(isThemeChoice("sepia")).toBe(false);
		expect(isThemeChoice("")).toBe(false);
		expect(isThemeChoice(null)).toBe(false);
		expect(isThemeChoice(undefined)).toBe(false);
		expect(isThemeChoice(42)).toBe(false);
	});

	it("an unknown stored string resolves through the auto branch", () => {
		const stored: unknown = "sepia";
		const choice = isThemeChoice(stored) ? stored : "auto";
		expect(resolveTheme(choice, true)).toBe("dark");
		expect(resolveTheme(choice, false)).toBe("light");
	});
});

describe("theme storage contract", () => {
	it("persists under the msauth-theme key", () => {
		expect(THEME_STORAGE_KEY).toBe("msauth-theme");
	});

	it("exposes exactly the three states in control order", () => {
		expect(themeChoices).toEqual(["auto", "light", "dark"]);
	});
});

describe("canvas palettes — dark adapts, light is the current ink/vermilion", () => {
	const channelSum = (hex: number): number =>
		((hex >> 16) & 0xff) + ((hex >> 8) & 0xff) + (hex & 0xff);

	it("keeps the light palette identical to the previous hardcoded ink/vermilion", () => {
		expect(scenePalette("light").ink).toBe(0x16150f);
		expect(scenePalette("light").accent).toBe(0xd9481c);
		expect(ledgerPalette("light").ink).toEqual({ r: 0x16, g: 0x15, b: 0x0f });
		expect(ledgerPalette("light").vermilion).toEqual({ r: 0xd9, g: 0x48, b: 0x1c });
	});

	it("brightens ink and the accent in dark mode", () => {
		const light = scenePalette("light");
		const dark = scenePalette("dark");
		expect(channelSum(dark.ink)).toBeGreaterThan(channelSum(light.ink));
		expect(dark.accent).toBeGreaterThan(light.accent);
	});

	it("lowers ink alpha in dark mode instead of stacking dark-on-dark", () => {
		const light = scenePalette("light");
		const dark = scenePalette("dark");
		expect(dark.nodeOpacity).toBeLessThan(light.nodeOpacity);
		expect(dark.edgeOpacity).toBeLessThanOrEqual(light.edgeOpacity);
		expect(dark.ringOpacity).toBeLessThanOrEqual(light.ringOpacity);
	});

	it("scales ledger stroke alpha down in dark mode", () => {
		expect(LEDGER_PALETTES.dark.alphaScale).toBeLessThan(LEDGER_PALETTES.light.alphaScale);
		const channelSumRgb = (c: { r: number; g: number; b: number }): number => c.r + c.g + c.b;
		expect(channelSumRgb(LEDGER_PALETTES.dark.ink)).toBeGreaterThan(
			channelSumRgb(LEDGER_PALETTES.light.ink),
		);
	});

	it("always resolves a palette for the current theme", () => {
		for (const theme of ["light", "dark"] as const) {
			expect(SCENE_PALETTES[theme]).toBeDefined();
			expect(LEDGER_PALETTES[theme]).toBeDefined();
		}
	});
});
