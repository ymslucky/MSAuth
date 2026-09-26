import { memo, useState, type CSSProperties, type ReactNode } from "react";
import { Check, ChevronDown, ChevronUp, ChevronsUpDown, Copy } from "lucide-react";
import { useActionLabel, useLang, useT, tMessage } from "./i18n";
import { EmptyIllustration, type EmptyArt } from "./illustrations";
import { fullTimestamp, maskId } from "./api";
import { formatWhen } from "./when";
import { Link } from "./router";
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
	const { lang } = useLang();
	if (!props.message) return null;
	return <p className="error-note" role="alert">{tMessage(props.message, lang)}</p>;
}

/** Card for failed page loads, with a Retry affordance. */
export function ErrorState(props: { message?: string | null; onRetry?: () => void }) {
	const t = useT();
	const { lang } = useLang();
	return (
		<div className="error-card" role="alert">
			<div>
				<strong>{t("Something went wrong.")}</strong>
				{props.message && <p>{tMessage(props.message, lang)}</p>}
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

/* ---------- timestamps: one `<time>` for every surface ---------- */

/**
 * Shared timestamp cell: relative wording inside 24h ("3 小时前" / "3 h ago"),
 * absolute locale string beyond — via the one pure helper in when.ts. The
 * full ISO stamp rides on `title` for correlation. Replaces the per-page
 * fmtDate/fullTimestamp dance.
 */
export function When(props: { value: number | string | undefined | null }) {
	const { lang } = useLang();
	return <time title={fullTimestamp(props.value) || undefined}>{formatWhen(props.value, lang)}</time>;
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
			scope="col"
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
 * static columns. `caption` names the table for screen readers (visually
 * hidden); every `<th>` carries scope="col".
 */
export function Table(props: {
	head: HeadCell[];
	rightCols?: number[];
	className?: string;
	caption?: string;
	sort?: { spec: SortSpec | null; onToggle: (key: string) => void };
	children: ReactNode;
}) {
	return (
		<div className="table-wrap">
			<table className={props.className}>
				{props.caption && <caption className="visually-hidden">{props.caption}</caption>}
				<thead>
					<tr>{props.head.map((cell, index) => {
						const right = props.rightCols?.includes(index) ? true : undefined;
						if (typeof cell === "string") {
							return <th key={cell} scope="col" className={right ? "right" : undefined}>{cell}</th>;
						}
						if (!props.sort?.spec) return <th key={cell.sortKey} scope="col" className={right ? "right" : undefined}>{cell.label}</th>;
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
 * the sidebar footer.) The subtitle paragraph always renders so async titles
 * never shift the header height.
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
				<p className="head-sub">{props.subtitle}</p>
			</div>
			<div className="head-side">
				{props.actions}
			</div>
		</div>
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
