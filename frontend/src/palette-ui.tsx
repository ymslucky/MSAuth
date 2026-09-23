import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import { useT } from "./i18n";
import { searchRanked } from "./palette";

/**
 * Command palette — provider + dialog. Split from ui.tsx: the provider owns
 * open state, the global ⌘K / Ctrl+K toggle and the merged entry list
 * (static entries from the shell + per-page resources registered while
 * loaded); the dialog is a single-field listbox with full keyboard control.
 */

export type PaletteGroup = "navigate" | "resource" | "action";

export interface PaletteEntry {
	id: string;
	group: PaletteGroup;
	label: string;
	/** Extra match text (ids, emails, raw codes) — ranked below the label. */
	keywords?: string;
	icon?: ReactNode;
	perform: () => void;
}

const PALETTE_GROUP_ORDER: readonly PaletteGroup[] = ["navigate", "resource", "action"];
const PALETTE_GROUP_CAP = 8;
const PALETTE_MAX_RESULTS = 12;
export const GITHUB_REPO_URL = "https://github.com/ymslucky/MSAuth";

interface PaletteContextValue {
	open: boolean;
	setOpen: (open: boolean) => void;
	register: (source: string, entries: PaletteEntry[] | null) => void;
}

const PaletteContext = createContext<PaletteContextValue>({
	open: false,
	setOpen: () => undefined,
	register: () => undefined,
});

export function PaletteProvider(props: { children: ReactNode; entries: PaletteEntry[] }) {
	const t = useT();
	const [open, setOpen] = useState(false);
	const [sources, setSources] = useState<ReadonlyMap<string, PaletteEntry[]>>(new Map());

	const register = useCallback((source: string, entries: PaletteEntry[] | null) => {
		setSources(current => {
			const existing = current.get(source);
			if (entries === null || entries.length === 0) {
				if (existing === undefined) return current;
				const next = new Map(current);
				next.delete(source);
				return next;
			}
			if (existing === entries) return current;
			const next = new Map(current);
			next.set(source, entries);
			return next;
		});
	}, []);

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "k") {
				event.preventDefault();
				setOpen(value => !value);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	const allEntries = useMemo(() => {
		const registered: PaletteEntry[] = [];
		for (const list of sources.values()) registered.push(...list);
		return [...props.entries, ...registered];
	}, [props.entries, sources]);

	const contextValue = useMemo(() => ({ open, setOpen, register }), [open, register]);
	const groupLabels = useMemo(() => ({
		navigate: t("Navigate"),
		resource: t("Resources"),
		action: t("Actions"),
	}), [t]);

	return (
		<PaletteContext.Provider value={contextValue}>
			{props.children}
			{open && (
				<PaletteDialog
					entries={allEntries}
					groupLabels={groupLabels}
					label={t("Command palette")}
					placeholder={t("Search or jump to…")}
					emptyLabel={t("No matching results.")}
					onClose={() => setOpen(false)}
				/>
			)}
		</PaletteContext.Provider>
	);
}

/** Open state of the palette (for trigger chips / buttons). */
export function usePalette(): { open: boolean; setOpen: (open: boolean) => void } {
	return useContext(PaletteContext);
}

/**
 * Register a page's in-memory rows for palette search. Pass `null` while the
 * list is loading (and on unmount the source unregisters automatically).
 * `entries` must be referentially stable (useMemo) — identity guards the
 * re-registration loop.
 */
export function usePaletteSource(source: string, entries: PaletteEntry[] | null): void {
	const { register } = useContext(PaletteContext);
	useEffect(() => {
		register(source, entries);
		return () => register(source, null);
	}, [register, source, entries]);
}

/** Grouped + ranked view of the palette entries for a query. */
function paletteResults(entries: readonly PaletteEntry[], query: string): PaletteEntry[] {
	const grouped = PALETTE_GROUP_ORDER.map(group => {
		const own = entries.filter(entry => entry.group === group);
		return searchRanked(own, query, entry => entry.label, entry => entry.keywords ?? "").slice(0, PALETTE_GROUP_CAP);
	});
	return grouped.flat().slice(0, PALETTE_MAX_RESULTS);
}

export const palettePlatformKey = (): string =>
	/mac/i.test(navigator.platform) ? "⌘K" : "Ctrl K";

function PaletteDialog(props: {
	entries: PaletteEntry[];
	groupLabels: Record<PaletteGroup, string>;
	label: string;
	placeholder: string;
	emptyLabel: string;
	onClose: () => void;
}) {
	const [query, setQuery] = useState("");
	const [selected, setSelected] = useState(0);
	const inputRef = useRef<HTMLInputElement>(null);
	const dialogRef = useRef<HTMLDivElement>(null);
	const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

	const results = useMemo(() => paletteResults(props.entries, query), [props.entries, query]);

	// New query or new result set → first result preselected.
	useEffect(() => {
		setSelected(0);
	}, [query, results]);

	useEffect(() => {
		const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		inputRef.current?.focus();
		return () => previous?.focus();
	}, []);

	useEffect(() => {
		itemRefs.current[selected]?.scrollIntoView({ block: "nearest" });
	}, [selected, results]);

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") props.onClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [props.onClose]);

	const run = (entry: PaletteEntry) => {
		props.onClose();
		entry.perform();
	};

	const onKeyDown = (event: React.KeyboardEvent) => {
		if (event.key === "ArrowDown" && results.length > 0) {
			event.preventDefault();
			setSelected(current => (current + 1) % results.length);
		} else if (event.key === "ArrowUp" && results.length > 0) {
			event.preventDefault();
			setSelected(current => (current - 1 + results.length) % results.length);
		} else if (event.key === "Enter") {
			event.preventDefault();
			const entry = results[Math.min(selected, results.length - 1)];
			if (entry) run(entry);
		} else if (event.key === "Tab" && dialogRef.current) {
			// Single-field dialog: Tab wraps onto the list, back-Tab exits to the trigger.
			const items = dialogRef.current.querySelectorAll<HTMLElement>(".palette-item");
			if (items.length > 0 && document.activeElement === inputRef.current && !event.shiftKey) {
				event.preventDefault();
				items[0].focus();
			}
		}
	};

	const activeId = results.length > 0 ? `palette-item-${Math.min(selected, results.length - 1)}` : undefined;
	let lastGroup: PaletteGroup | null = null;

	return (
		<div className="palette-backdrop" onClick={props.onClose}>
			<div
				className="palette"
				role="dialog"
				aria-modal="true"
				aria-label={props.label}
				ref={dialogRef}
				tabIndex={-1}
				onKeyDown={onKeyDown}
				onClick={event => event.stopPropagation()}
			>
				<div className="palette-input-row">
					<Search size={15} strokeWidth={2} aria-hidden />
					<input
						ref={inputRef}
						className="palette-input"
						value={query}
						onChange={event => setQuery(event.target.value)}
						placeholder={props.placeholder}
						spellCheck={false}
						role="combobox"
						aria-expanded={results.length > 0}
						aria-controls="palette-list"
						aria-activedescendant={activeId}
						aria-label={props.placeholder}
					/>
					<kbd className="palette-kbd" aria-hidden="true">esc</kbd>
				</div>
				{results.length === 0 ? (
					<p className="palette-empty">{props.emptyLabel}</p>
				) : (
					<div className="palette-list" role="listbox" id="palette-list" aria-label={props.placeholder}>
						{results.map((entry, index) => {
							const showGroup = entry.group !== lastGroup;
							lastGroup = entry.group;
							return (
								<div key={entry.id} role="presentation">
									{showGroup && <div className="palette-group" aria-hidden="true">{props.groupLabels[entry.group]}</div>}
									<button
										ref={node => { itemRefs.current[index] = node; }}
										type="button"
										role="option"
										id={`palette-item-${index}`}
										className="palette-item"
										data-active={index === selected}
										aria-selected={index === selected}
										onMouseEnter={() => setSelected(index)}
										onClick={() => run(entry)}
									>
										{entry.icon}
										<span className="palette-label">{entry.label}</span>
									</button>
								</div>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}
