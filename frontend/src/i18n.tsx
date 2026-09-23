import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { zh } from "./dict";

export type Lang = "zh" | "en";

const STORAGE_KEY = "msauth-lang";

// Dictionary data lives in ./dict (pure, test-walked); this module is the
// React half: provider, hooks and the language control.
export { zh };

interface LangContextValue {
	lang: Lang;
	setLang: (lang: Lang) => void;
}

const LangContext = createContext<LangContextValue>({ lang: "zh", setLang: () => undefined });

function initialLang(): Lang {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored === "zh" || stored === "en") return stored;
	} catch {
		// storage unavailable — fall through to default
	}
	return "zh";
}

export function LangProvider(props: { children: ReactNode }) {
	const [lang, setLang] = useState<Lang>(initialLang);
	const firstRun = useRef(true);
	useEffect(() => {
		document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
		try {
			localStorage.setItem(STORAGE_KEY, lang);
		} catch {
			// storage unavailable — language still applies for this session
		}
	}, [lang]);
	// Brief opacity dip on the document when the language flips — masks the
	// re-render flash. Skipped on first mount and under prefers-reduced-motion.
	useEffect(() => {
		if (firstRun.current) {
			firstRun.current = false;
			return undefined;
		}
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
		const root = document.documentElement;
		root.classList.add("lang-dip");
		const release = () => root.classList.remove("lang-dip");
		const onEnd = (event: TransitionEvent) => {
			if (event.target === document.body && event.propertyName === "opacity") release();
		};
		root.addEventListener("transitionend", onEnd);
		const safety = window.setTimeout(release, 240); // transitions may never fire
		return () => {
			root.removeEventListener("transitionend", onEnd);
			window.clearTimeout(safety);
			release();
		};
	}, [lang]);
	const value = useMemo(() => ({ lang, setLang }), [lang]);
	return <LangContext.Provider value={value}>{props.children}</LangContext.Provider>;
}

export function useT() {
	const { lang } = useContext(LangContext);
	return useCallback((key: string, vars?: Record<string, string | number>) => {
		const text = lang === "zh" ? (zh[key] ?? key) : key;
		if (!vars) return text;
		return Object.entries(vars).reduce(
			(acc, [name, value]) => acc.replaceAll(`{${name}}`, String(value)),
			text,
		);
	}, [lang]);
}

/** Lang + setter for language-switch affordances outside the segmented control. */
export function useLang(): { lang: Lang; setLang: (lang: Lang) => void } {
	return useContext(LangContext);
}

/**
 * Audit action code → label. Chinese label when translated, raw code as
 * fallback (and in EN mode, since codes are technical identifiers).
 */
export function tAction(code: string, lang: Lang = "zh"): string {
	if (lang !== "zh") return code;
	return zh[code] ?? code;
}

/** Lang-aware `tAction` for components. */
export function useActionLabel(): (code: string) => string {
	const { lang } = useContext(LangContext);
	return useCallback((code: string) => tAction(code, lang), [lang]);
}

/** Compact segmented `中文 | EN` control — reads as a setting, not a button. */
export function LangSegmented() {
	const { lang, setLang } = useContext(LangContext);
	const t = useT();
	return (
		<div className="lang-seg" role="group" aria-label={t("Language")}>
			<span className="lang-thumb" data-lang={lang} aria-hidden="true" />
			<button type="button" className={lang === "zh" ? "active" : ""} aria-pressed={lang === "zh"} onClick={() => setLang("zh")}>中文</button>
			<button type="button" className={lang === "en" ? "active" : ""} aria-pressed={lang === "en"} onClick={() => setLang("en")}>EN</button>
		</div>
	);
}
