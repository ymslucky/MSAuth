/**
 * Theme — ONE module, single responsibility: the three-state choice
 * (auto/light/dark) persisted under msauth-theme, resolved against the live
 * `prefers-color-scheme`, plus the canvas palettes so the login scene and the
 * Quiet Ledger re-ink on theme flips.
 *
 * Everything above the provider section is pure (tested in
 * test/frontend/theme.test.ts, no DOM at module scope). The pre-paint
 * bootstrap is public/theme-boot.js — keep the storage key and the
 * auto/light/dark semantics in sync with it.
 */
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Moon, Sun, SunMoon } from "lucide-react";
import { useT } from "./i18n";

/* ---------- pure resolution logic ---------- */

export type ThemeChoice = "auto" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "msauth-theme";

/** Order defines the three-state control layout. */
export const themeChoices: readonly ThemeChoice[] = ["auto", "light", "dark"];

/** Narrow a stored value; anything else falls back to "auto". */
export function isThemeChoice(value: unknown): value is ThemeChoice {
	return value === "auto" || value === "light" || value === "dark";
}

/** Stored choice wins; "auto" follows the system preference. */
export function resolveTheme(choice: ThemeChoice, systemPrefersDark: boolean): ResolvedTheme {
	if (choice === "auto") return systemPrefersDark ? "dark" : "light";
	return choice;
}

/* ---------- canvas palettes: ink on paper, dark = brighter, lower alpha ---------- */

export interface ScenePalette {
	/** Field/edge/ring ink as a numeric RGB (three.js convention). */
	ink: number;
	/** Vermilion audit marks (numeric RGB). */
	accent: number;
	/** Base opacities; dark lowers ink alpha on the near-black ground. */
	nodeOpacity: number;
	edgeOpacity: number;
	ringOpacity: number;
	/** Halo breathing baseline. */
	haloOpacity: number;
}

export const SCENE_PALETTES: Record<ResolvedTheme, ScenePalette> = {
	light: {
		ink: 0x16150f,
		accent: 0xd9481c,
		nodeOpacity: 0.5,
		edgeOpacity: 0.09,
		ringOpacity: 0.12,
		haloOpacity: 0.13,
	},
	dark: {
		ink: 0xece9e2,
		accent: 0xf0663a,
		nodeOpacity: 0.32,
		edgeOpacity: 0.05,
		ringOpacity: 0.07,
		haloOpacity: 0.09,
	},
};

export function scenePalette(theme: ResolvedTheme): ScenePalette {
	return SCENE_PALETTES[theme];
}

export interface LedgerPalette {
	ink: { r: number; g: number; b: number };
	vermilion: { r: number; g: number; b: number };
	/** Multiplier on every stroke alpha. */
	alphaScale: number;
}

export const LEDGER_PALETTES: Record<ResolvedTheme, LedgerPalette> = {
	light: {
		ink: { r: 0x16, g: 0x15, b: 0x0f },
		vermilion: { r: 0xd9, g: 0x48, b: 0x1c },
		alphaScale: 1,
	},
	dark: {
		ink: { r: 0xec, g: 0xe9, b: 0xe2 },
		vermilion: { r: 0xf0, g: 0x66, b: 0x3a },
		alphaScale: 0.72,
	},
};

export function ledgerPalette(theme: ResolvedTheme): LedgerPalette {
	return LEDGER_PALETTES[theme];
}

/* ---------- React provider + three-state toggle ---------- */

const systemPrefersDark = (): boolean =>
	window.matchMedia("(prefers-color-scheme: dark)").matches;

function initialChoice(): ThemeChoice {
	try {
		const stored = localStorage.getItem(THEME_STORAGE_KEY);
		if (isThemeChoice(stored)) return stored;
	} catch {
		// storage unavailable — follow the system for this session
	}
	return "auto";
}

interface ThemeContextValue {
	choice: ThemeChoice;
	resolved: ResolvedTheme;
	setChoice: (choice: ThemeChoice) => void;
}

const ThemeContext = createContext<ThemeContextValue>({ choice: "auto", resolved: "light", setChoice: () => undefined });

export function ThemeProvider(props: { children: ReactNode }) {
	const [choice, setChoice] = useState<ThemeChoice>(initialChoice);
	const [systemDark, setSystemDark] = useState(systemPrefersDark);

	// "auto" must follow the OS setting live, not just at mount.
	useEffect(() => {
		const query = window.matchMedia("(prefers-color-scheme: dark)");
		const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
		query.addEventListener("change", onChange);
		return () => query.removeEventListener("change", onChange);
	}, []);

	const resolved = resolveTheme(choice, systemDark);

	useEffect(() => {
		document.documentElement.dataset.theme = resolved;
		try {
			localStorage.setItem(THEME_STORAGE_KEY, choice);
		} catch {
			// storage unavailable — theme still applies for this session
		}
		// theme-color tracks the resolved --bg so the OS chrome follows along.
		document.querySelector('meta[name="theme-color"]')
			?.setAttribute("content", getComputedStyle(document.documentElement).getPropertyValue("--bg").trim());
	}, [resolved, choice]);

	const value = useMemo(() => ({ choice, resolved, setChoice }), [choice, resolved]);
	return <ThemeContext.Provider value={value}>{props.children}</ThemeContext.Provider>;
}

/** Resolved theme + raw choice; canvas mounts key their palettes off this. */
export function useTheme(): ThemeContextValue {
	return useContext(ThemeContext);
}

const CHOICE_ICONS: Record<ThemeChoice, typeof Sun> = {
	auto: SunMoon,
	light: Sun,
	dark: Moon,
};

const CHOICE_LABELS: Record<ThemeChoice, string> = {
	auto: "Auto",
	light: "Light",
	dark: "Dark",
};

/**
 * Three-state theme control: one trigger button opening a small popover
 * (自动 / 浅色 / 深色). Styled after the copy button; anchored next to the
 * language segmented control. Popover opens downward under top bars
 * (brand-row / login-toggle), upward everywhere else (sidebar footer).
 */
export function ThemeToggle() {
	const { choice, setChoice } = useTheme();
	const t = useT();
	const [open, setOpen] = useState(false);
	const rootRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return undefined;
		const onDown = (event: PointerEvent) => {
			if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
		};
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") setOpen(false);
		};
		window.addEventListener("pointerdown", onDown);
		window.addEventListener("keydown", onKey);
		return () => {
			window.removeEventListener("pointerdown", onDown);
			window.removeEventListener("keydown", onKey);
		};
	}, [open]);

	const Trigger = CHOICE_ICONS[choice];
	return (
		<div className="theme-toggle" ref={rootRef}>
			<button
				type="button"
				className="copy-btn theme-trigger"
				aria-haspopup="menu"
				aria-expanded={open}
				aria-label={t("Theme")}
				title={t("Theme")}
				onClick={() => setOpen(value => !value)}
			><Trigger size={14} strokeWidth={2} aria-hidden /></button>
			{open && (
				<div className="theme-pop" role="menu" aria-label={t("Theme")}>
					{themeChoices.map(item => {
						const Icon = CHOICE_ICONS[item];
						return (
							<button
								key={item}
								type="button"
								role="menuitemradio"
								aria-checked={choice === item}
								onClick={() => { setChoice(item); setOpen(false); }}
							>
								<Icon size={14} strokeWidth={2} aria-hidden />
								{t(CHOICE_LABELS[item])}
							</button>
						);
					})}
				</div>
			)}
		</div>
	);
}
