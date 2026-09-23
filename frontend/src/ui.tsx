import { createContext, memo, useCallback, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Check, CheckCircle2, ChevronDown, ChevronUp, ChevronsUpDown, CircleAlert, Copy, Info, Search, X } from "lucide-react";
import { useActionLabel, useT } from "./i18n";
import { EmptyIllustration, type EmptyArt } from "./illustrations";
import { maskId } from "./api";
import { Link } from "./router";
import { capVisibleToasts, noticeTtl, type NoticeTone } from "./notice";
import { searchRanked } from "./palette";
import { type SortDir, type SortSpec } from "./table";

export function Card(props: { title?: string; actions?: ReactNode; children: ReactNode }) {
	return (
		<section className="card">
			{(props.title || props.actions) && (
				<header className="card-head">
					<h2>{props.title}</h2>
					{props.actions}
				</header>
			)}
			{props.children}
		</section>
	);
}

export function Button(props: {
	onClick?: () => void;
	kind?: "primary" | "danger" | "danger-solid" | "ghost";
	disabled?: boolean;
	/** Pending state: spinner + disabled, so submits never look dead. */
	busy?: boolean;
	type?: "button" | "submit";
	className?: string;
	ariaLabel?: string;
	children: ReactNode;
}) {
	return (
		<button
			type={props.type ?? "button"}
			className={`btn ${props.kind ?? ""} ${props.className ?? ""}`}
			onClick={props.onClick}
			disabled={props.disabled || props.busy}
			aria-label={props.ariaLabel}
			aria-busy={props.busy || undefined}
		>
			{props.busy && <span className="spinner" aria-hidden="true" />}
			{props.children}
		</button>
	);
}

export function Field(props: { label: string; children: ReactNode; hint?: string; error?: string | null; count?: string; required?: boolean }) {
	return (
		<label className={`field ${props.error ? "has-error" : ""}`}>
			<span>{props.label}{props.required && <em className="req" aria-hidden="true"> *</em>}</span>
			{props.children}
			{props.error
				? <small className="field-error" role="alert">{props.error}</small>
				: props.hint && <small className="hint">{props.hint}</small>}
			{props.count && <small className="count">{props.count}</small>}
		</label>
	);
}

/** Neutral status pill. Memoized: hot tables re-render these per keystroke. */
export const Badge = memo(function Badge(props: { tone?: "ok" | "warn" | "bad"; children: ReactNode }) {
	return <span className={`badge ${props.tone ?? ""}`}>{props.children}</span>;
});

/* ---------- tags: finite tone vocabulary for resource types & actions ---------- */

export type ResourceTone =
	| "agent" | "delegation" | "apikey" | "user" | "session"
	| "domain" | "alert" | "resource" | "client" | "other";

/** The finite tone set — every tone has a matching `.tag.tag--<tone>` class. */
export const RESOURCE_TONES: readonly ResourceTone[] = [
	"agent", "delegation", "apikey", "user", "session",
	"domain", "alert", "resource", "client", "other",
];

/** Backend resourceType → tone; anything unknown falls back to neutral "other". */
const RESOURCE_TYPE_TONES: Record<string, ResourceTone> = {
	agent: "agent",
	delegation: "delegation",
	key: "apikey",
	user: "user",
	session: "session",
	domain: "domain",
	alert: "alert",
	resource: "resource",
	application: "client",
	platform: "other",
};

export function resourceTone(type: string): ResourceTone {
	return RESOURCE_TYPE_TONES[type] ?? "other";
}

/**
 * Colored type pill for a backend resourceType: soft tinted background, deep
 * matching text, hairline border. Keeps `title` = raw type for correlation.
 * Memoized: audit/user tables (30 rows) re-render on every filter keystroke.
 */
export const ResourceTag = memo(function ResourceTag(props: { type: string }) {
	return <span className={`tag tag--${resourceTone(props.type)}`} title={props.type}>{props.type}</span>;
});

/**
 * Neutral pill for an audit action code, showing its translated label
 * (see tAction) with the raw code preserved in `title` for log correlation.
 */
export function ActionTag(props: { code: string }) {
	const actionLabel = useActionLabel();
	return <span className="badge action" title={props.code}>{actionLabel(props.code)}</span>;
}

/** Inline mutation-failure note (fetch failures use `ErrorState` instead). */
export function ErrorNote(props: { message?: string | null }) {
	if (!props.message) return null;
	return <p className="error-note" role="alert">{props.message}</p>;
}

/** Card for failed page loads, with a Retry affordance. */
export function ErrorState(props: { message?: string | null; onRetry?: () => void }) {
	const t = useT();
	return (
		<div className="error-card" role="alert">
			<div>
				<strong>{t("Something went wrong.")}</strong>
				{props.message && <p>{props.message}</p>}
			</div>
			{props.onRetry && <Button kind="ghost" onClick={props.onRetry}>{t("Retry")}</Button>}
		</div>
	);
}

/**
 * Empty-state primitive: hand-drawn illustration + title + optional hint +
 * primary action. `art` picks from the finite illustration vocabulary
 * (illustrations.tsx) so every first-run moment reads in the same hand.
 */
export function EmptyState(props: {
	art: EmptyArt;
	title: ReactNode;
	hint?: ReactNode;
	action?: ReactNode;
}) {
	return (
		<div className="empty-state">
			<EmptyIllustration art={props.art} />
			<p className="empty-title">{props.title}</p>
			{props.hint && <p className="empty-hint">{props.hint}</p>}
			{props.action && <div className="empty-action">{props.action}</div>}
		</div>
	);
}

/* ---------- sortable table head ---------- */

/** Head cells are plain labels or sortable `{ label, sortKey }` entries. */
export type HeadCell = string | { label: string; sortKey: string };

function SortCaret(props: { dir: SortDir | null }) {
	if (props.dir === "asc") return <ChevronUp size={12} strokeWidth={2.25} aria-hidden />;
	if (props.dir === "desc") return <ChevronDown size={12} strokeWidth={2.25} aria-hidden />;
	return <ChevronsUpDown size={12} strokeWidth={2} aria-hidden />;
}

function SortHeader(props: { label: string; sortKey: string; spec: SortSpec; onToggle: (key: string) => void; right?: boolean }) {
	const active = props.spec.key === props.sortKey;
	const dir: SortDir | null = active ? props.spec.dir : null;
	return (
		<th
			className={props.right ? "right" : undefined}
			aria-sort={active ? (props.spec.dir === "asc" ? "ascending" : "descending") : undefined}
		>
			<button type="button" className={`sort-head${active ? " active" : ""}`} onClick={() => props.onToggle(props.sortKey)}>
				{props.label}
				<SortCaret dir={dir} />
			</button>
		</th>
	);
}

/**
 * Data table shell. Pass `sort` (from useTableState) plus sortable head cells
 * to get clickable column headers with aria-sort + caret; plain strings stay
 * static columns.
 */
export function Table(props: {
	head: HeadCell[];
	rightCols?: number[];
	className?: string;
	sort?: { spec: SortSpec | null; onToggle: (key: string) => void };
	children: ReactNode;
}) {
	return (
		<div className="table-wrap">
			<table className={props.className}>
				<thead>
					<tr>{props.head.map((cell, index) => {
						const right = props.rightCols?.includes(index) ? true : undefined;
						if (typeof cell === "string") {
							return <th key={cell} className={right ? "right" : undefined}>{cell}</th>;
						}
						if (!props.sort?.spec) return <th key={cell.sortKey} className={right ? "right" : undefined}>{cell.label}</th>;
						return (
							<SortHeader
								key={cell.sortKey}
								label={cell.label}
								sortKey={cell.sortKey}
								spec={props.sort.spec}
								onToggle={props.sort.onToggle}
								right={right}
							/>
						);
					})}</tr>
				</thead>
				<tbody>{props.children}</tbody>
			</table>
		</div>
	);
}

/* ---------- filter chips + pager: the shared table toolbar vocabulary ---------- */

/** Toggleable filter chips above a table — pill vocabulary shared with .tag. */
export function FilterChips(props: {
	ariaLabel: string;
	chips: { key: string; label: string; tone?: string }[];
	active: ReadonlySet<string>;
	onToggle: (key: string) => void;
}) {
	return (
		<div className="chip-row" role="group" aria-label={props.ariaLabel}>
			{props.chips.map(chip => {
				const on = props.active.has(chip.key);
				return (
					<button
						key={chip.key}
						type="button"
						className={`chip ${chip.tone ? `chip--${chip.tone}` : ""}${on ? " on" : ""}`}
						aria-pressed={on}
						onClick={() => props.onToggle(chip.key)}
					>{chip.label}</button>
				);
			})}
		</div>
	);
}

/** Prev/next pager with the "x–y / z" range label. Hidden by the caller when `pages <= 1`. */
export function TablePager(props: {
	page: number;
	pages: number;
	start: number;
	end: number;
	total: number;
	onPage: (page: number) => void;
}) {
	const t = useT();
	return (
		<div className="pager">
			<Button kind="ghost" disabled={props.page <= 1} ariaLabel={t("Previous page")} onClick={() => props.onPage(props.page - 1)}>{t("← Prev")}</Button>
			<span className="muted mono">{props.start}–{props.end} / {props.total}</span>
			<Button kind="ghost" disabled={props.page >= props.pages} ariaLabel={t("Next page")} onClick={() => props.onPage(props.page + 1)}>{t("Next →")}</Button>
		</div>
	);
}

/**
 * Page title row: optional breadcrumb (Console → section → page), title,
 * subtitle — with page actions right-aligned. (The language control lives in
 * the sidebar footer.)
 */
export function PageHeader(props: {
	title: ReactNode;
	subtitle?: ReactNode;
	crumbs?: { label: string; to?: string }[];
	actions?: ReactNode;
}) {
	const t = useT();
	const crumbs = props.crumbs ?? [];
	const last = crumbs.length - 1;
	return (
		<div className="main-head fade-up">
			<div>
				{crumbs.length > 0 && (
					<nav className="crumbs" aria-label={t("Breadcrumb")}>
						{crumbs.map((crumb, index) => (
							<span className="crumb" key={index}>
								{crumb.to
									? <Link to={crumb.to}>{crumb.label}</Link>
									: <span aria-current={index === last ? "page" : undefined}>{crumb.label}</span>}
							</span>
						))}
					</nav>
				)}
				<h1>{props.title}</h1>
				{props.subtitle && <p>{props.subtitle}</p>}
			</div>
			<div className="head-side">
				{props.actions}
			</div>
		</div>
	);
}

export function Modal(props: { title: string; open: boolean; onClose: () => void; children: ReactNode }) {
	const t = useT();
	const closeRef = useRef(props.onClose);
	closeRef.current = props.onClose;
	const dialogRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (!props.open) return undefined;
		const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		const node = dialogRef.current;
		node?.focus();
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				closeRef.current();
				return;
			}
			// Keep Tab focus inside the dialog while it is open.
			if (event.key !== "Tab" || !node) return;
			const focusables = node.querySelectorAll<HTMLElement>(
				'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
			);
			if (focusables.length === 0) return;
			const first = focusables[0];
			const last = focusables[focusables.length - 1];
			const active = document.activeElement;
			if (event.shiftKey && (active === first || active === node)) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && active === last) {
				event.preventDefault();
				first.focus();
			}
		};
		window.addEventListener("keydown", onKey);
		return () => {
			window.removeEventListener("keydown", onKey);
			previous?.focus();
		};
	}, [props.open]);
	if (!props.open) return null;
	return (
		<div className="modal-backdrop" onClick={props.onClose}>
			<div
				className="modal"
				role="dialog"
				aria-modal="true"
				aria-label={props.title}
				ref={dialogRef}
				tabIndex={-1}
				onClick={event => event.stopPropagation()}
			>
				<header className="card-head">
					<h2>{props.title}</h2>
					<Button kind="ghost" ariaLabel={t("Close")} onClick={props.onClose}><X size={15} strokeWidth={2} aria-hidden /></Button>
				</header>
				{props.children}
			</div>
		</div>
	);
}

/** Styled destructive-confirmation dialog (replaces window.confirm). */
export function Confirm(props: {
	open: boolean;
	title: string;
	body?: string;
	confirmLabel: string;
	busy?: boolean;
	onConfirm: () => void;
	onCancel: () => void;
}) {
	const t = useT();
	if (!props.open) return null;
	return (
		<Modal title={props.title} open onClose={props.onCancel}>
			{props.body && <p className="confirm-body">{props.body}</p>}
			<div className="btn-row">
				<Button kind="danger-solid" busy={props.busy} onClick={props.onConfirm}>{props.confirmLabel}</Button>
				<Button kind="ghost" disabled={props.busy} onClick={props.onCancel}>{t("Cancel")}</Button>
			</div>
		</Modal>
	);
}

export function Stat(props: { label: string; value: ReactNode; style?: CSSProperties }) {
	return (
		<div className="stat" style={props.style}>
			<strong>{props.value}</strong>
			<span>{props.label}</span>
		</div>
	);
}

/* ---------- loading skeletons ---------- */

export function Skeleton(props: { style?: CSSProperties }) {
	return <span className="skeleton" style={props.style} aria-hidden="true" />;
}

export function SkeletonStats(props: { count?: number }) {
	const t = useT();
	return (
		<div className="skel-stats" role="status" aria-label={t("Loading…")}>
			{Array.from({ length: props.count ?? 4 }, (_, index) => (
				<div className="skel-stat" key={index}>
					<Skeleton style={{ width: 52, height: 26 }} />
					<Skeleton style={{ width: 90, marginTop: 9 }} />
				</div>
			))}
		</div>
	);
}

export function SkeletonTable(props: { rows?: number }) {
	const t = useT();
	const widths = ["92%", "76%", "60%", "84%", "68%", "80%"];
	return (
		<div className="skel-table" role="status" aria-label={t("Loading…")}>
			{Array.from({ length: props.rows ?? 5 }, (_, index) => (
				<Skeleton key={index} style={{ width: widths[index % widths.length] }} />
			))}
		</div>
	);
}

/** Skeleton matching the `.profile-grid` geometry (user detail page). */
export function SkeletonProfile(props: { cells?: number }) {
	const t = useT();
	return (
		<div className="skel-profile" role="status" aria-label={t("Loading…")}>
			{Array.from({ length: props.cells ?? 4 }, (_, index) => (
				<div key={index}>
					<Skeleton style={{ width: 64, height: 11 }} />
					<Skeleton style={{ width: "72%", height: 14, marginTop: 9 }} />
				</div>
			))}
		</div>
	);
}

/* ---------- copy affordances ---------- */

/** Icon-only copy affordance: 14px glyph that flips to a check for ~1.2s. */
export const CopyButton = memo(function CopyButton(props: { value: string; label?: string }) {
	const t = useT();
	const [copied, setCopied] = useState(false);
	const copy = () => {
		void navigator.clipboard.writeText(props.value).then(() => {
			setCopied(true);
			window.setTimeout(() => setCopied(false), 1200);
		}).catch(() => undefined);
	};
	return (
		<button
			type="button"
			className={`copy-btn ${copied ? "copied" : ""}`}
			onClick={copy}
			aria-label={props.label ?? t("Copy")}
			title={copied ? t("Copied") : t("Copy")}
		>
			{copied ? <Check size={14} strokeWidth={2.25} aria-hidden /> : <Copy size={14} strokeWidth={2} aria-hidden />}
		</button>
	);
});

/**
 * JetBrains Mono identifier with a `<title>`, a CopyButton (which carries the
 * full value) and — by default — a masked display via `maskId`, since these
 * are opaque machine identifiers. Pass `mask={false}` for values a human may
 * want to read in full (URLs, hostnames, IPs); those still truncate via CSS.
 * Memoized: the most repeated cell in list-heavy tables.
 */
export const MonoId = memo(function MonoId(props: { value: string; wide?: boolean; mask?: boolean }) {
	return (
		<span className={`mono-id ${props.wide ? "wide" : ""}`}>
			<span title={props.value}>{props.mask === false ? props.value : maskId(props.value)}</span>
			<CopyButton value={props.value} />
		</span>
	);
});

/* ---------- unified notice stack: toasts + confirm promise ---------- */

interface ToastItem {
	id: number;
	tone: NoticeTone;
	text: string;
	actionLabel?: string;
	onAction?: () => void;
}

const TOAST_ICONS: Record<NoticeTone, typeof CheckCircle2> = {
	success: CheckCircle2,
	error: CircleAlert,
	info: Info,
};

export interface ConfirmOptions {
	title: string;
	body?: string;
	confirmLabel: string;
}

export interface NoticeApi {
	/** Push a success/error/info toast (auto-dismisses; click to dismiss). */
	toast: (tone: NoticeTone, text: string, opts?: { actionLabel?: string; onAction?: () => void }) => void;
	/** Promise-based destructive-action dialog — resolves true only on confirm. */
	confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

const NoticeContext = createContext<NoticeApi>({
	toast: () => undefined,
	confirm: () => Promise.resolve(false),
});

let noticeSeq = 0;

export function NoticeProvider(props: { children: ReactNode }) {
	const t = useT();
	const [toasts, setToasts] = useState<ToastItem[]>([]);
	const [confirmState, setConfirmState] = useState<ConfirmOptions | null>(null);
	const confirmResolve = useRef<((confirmed: boolean) => void) | null>(null);
	const timers = useRef(new Map<number, number>());

	const dismiss = useCallback((id: number) => {
		const timer = timers.current.get(id);
		if (timer !== undefined) {
			window.clearTimeout(timer);
			timers.current.delete(id);
		}
		setToasts(current => current.filter(item => item.id !== id));
	}, []);

	useEffect(() => () => {
		for (const timer of timers.current.values()) window.clearTimeout(timer);
		timers.current.clear();
	}, []);

	const toast = useCallback<NoticeApi["toast"]>((tone, text, opts) => {
		const id = ++noticeSeq;
		setToasts(current => capVisibleToasts([...current, { id, tone, text, ...opts }]));
		timers.current.set(id, window.setTimeout(() => dismiss(id), noticeTtl(tone)));
	}, [dismiss]);

	const confirm = useCallback<NoticeApi["confirm"]>(opts =>
		new Promise<boolean>(resolve => {
			confirmResolve.current = resolve;
			setConfirmState(opts);
		}), []);

	const settleConfirm = useCallback((confirmed: boolean) => {
		confirmResolve.current?.(confirmed);
		confirmResolve.current = null;
		setConfirmState(null);
	}, []);

	return (
		<NoticeContext.Provider value={{ toast, confirm }}>
			{props.children}
			<div className="toaster" role="status" aria-live="polite">
				{toasts.map(item => {
					const Icon = TOAST_ICONS[item.tone];
					return (
						<div key={item.id} className={`toast ${item.tone}`} onClick={() => dismiss(item.id)}>
							<Icon size={15} strokeWidth={2} aria-hidden />
							<span className="toast-text">{item.text}</span>
							{item.actionLabel && (
								<button
									type="button"
									className="toast-action"
									onClick={event => {
										event.stopPropagation();
										dismiss(item.id);
										item.onAction?.();
									}}
								>{item.actionLabel}</button>
							)}
							<button
								type="button"
								className="toast-close"
								aria-label={t("Dismiss")}
								onClick={event => { event.stopPropagation(); dismiss(item.id); }}
							><X size={13} strokeWidth={2} aria-hidden /></button>
						</div>
					);
				})}
			</div>
			{confirmState && (
				<Confirm
					open
					title={confirmState.title}
					body={confirmState.body}
					confirmLabel={confirmState.confirmLabel}
					onConfirm={() => settleConfirm(true)}
					onCancel={() => settleConfirm(false)}
				/>
			)}
		</NoticeContext.Provider>
	);
}

export function useNotice(): NoticeApi {
	return useContext(NoticeContext);
}

/* ---------- command palette (⌘K / Ctrl+K) ---------- */

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

/**
 * Owns the palette open state, the global ⌘K / Ctrl+K toggle and the merged
 * entry list: static entries (navigation, actions) from the mount point plus
 * the in-memory resources pages register while loaded. Renders the overlay so
 * registry updates flow through provider state.
 */
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
