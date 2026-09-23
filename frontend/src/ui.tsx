import { createContext, useCallback, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Check, CheckCircle2, CircleAlert, Copy, Info, X } from "lucide-react";
import { useT } from "./i18n";
import { maskId } from "./api";
import { Link } from "./router";
import { capVisibleToasts, noticeTtl, type NoticeTone } from "./notice";

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

export function Badge(props: { tone?: "ok" | "warn" | "bad"; children: ReactNode }) {
	return <span className={`badge ${props.tone ?? ""}`}>{props.children}</span>;
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

/** Editorial empty state: serif glyph + one-line explanation + optional CTA. */
export function Empty(props: { glyph?: string; children: ReactNode; action?: ReactNode }) {
	return (
		<div className="empty">
			{props.glyph && <span className="empty-glyph" aria-hidden="true">{props.glyph}</span>}
			<p>{props.children}</p>
			{props.action && <div className="empty-action">{props.action}</div>}
		</div>
	);
}

export function Table(props: { head: string[]; rightCols?: number[]; className?: string; children: ReactNode }) {
	return (
		<div className="table-wrap">
			<table className={props.className}>
				<thead>
					<tr>{props.head.map((head, index) => (
						<th key={head} className={props.rightCols?.includes(index) ? "right" : undefined}>{head}</th>
					))}</tr>
				</thead>
				<tbody>{props.children}</tbody>
			</table>
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

/* ---------- copy affordances ---------- */

/** Icon-only copy affordance: 14px glyph that flips to a check for ~1.2s. */
export function CopyButton(props: { value: string; label?: string }) {
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
}

/**
 * JetBrains Mono identifier with a `<title>`, a CopyButton (which carries the
 * full value) and — by default — a masked display via `maskId`, since these
 * are opaque machine identifiers. Pass `mask={false}` for values a human may
 * want to read in full (URLs, hostnames, IPs); those still truncate via CSS.
 */
export function MonoId(props: { value: string; wide?: boolean; mask?: boolean }) {
	return (
		<span className={`mono-id ${props.wide ? "wide" : ""}`}>
			<span title={props.value}>{props.mask === false ? props.value : maskId(props.value)}</span>
			<CopyButton value={props.value} />
		</span>
	);
}

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
