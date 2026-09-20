/**
 * MSAuth hand-drawn design tokens (single source of truth).
 * Referenced by every page via TOKENS_CSS; keep in sync with the visual
 * language documented in AGENTS.md.
 */
export const TOKENS_CSS = `:root {
	--paper: #fbf7ee;
	--card: #fffdf6;
	--ink: #33302a;
	--ink-soft: #7a7062;
	--line: #d9d2c0;
	--primary: #2f5ac9;
	--primary-dark: #2447a3;
	--danger: #c94436;
	--ok: #3f8f5f;
	--highlight: #ffe98a;
	--chip: #f3eede;
	--radius-sketch: 255px 15px 225px 15px / 15px 225px 15px 255px;
	--shadow-sketch: 3px 4px 0 rgba(51, 48, 42, 0.22);
	--font-hand: "Segoe Print", "Comic Sans MS", "Kaiti SC", "楷体", "STKaiti", cursive;
}`;

/** The hand font stack used across the sketch design system. */
export const FONT_HAND =
	"Segoe Print, Comic Sans MS, Kaiti SC, 楷体, STKaiti, cursive";