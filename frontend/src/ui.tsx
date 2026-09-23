import { createContext, useCallback, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useT } from "./i18n";

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
	type?: "button" | "submit";
	ariaLabel?: string;
	children: ReactNode;
}) {
	return (
		<button
			type={props.type ?? "button"}
			className={`btn ${props.kind ?? ""}`}
			onClick={props.onClick}
			disabled={props.disabled}
			aria-label={props.ariaLabel}
		>
			{props.children}
		</button>
	);
}

export function Field(props: { label: string; children: ReactNode; hint?: string; error?: string | null; count?: string }) {
	return (
		<label className={`field ${props.error ? "has-error" : ""}`}>
			<span>{props.label}</span>
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

export function Table(props: { head: string[]; rightCols?: number[]; children: ReactNode }) {
	return (
		<div className="table-wrap">
			<table>
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

export function Modal(props: { title: string; open: boolean; onClose: () => void; children: ReactNode }) {
	const t = useT();
	const closeRef = useRef(props.onClose);
	closeRef.current = props.onClose;
	useEffect(() => {
		if (!props.open) return;
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") closeRef.current();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [props.open]);
	if (!props.open) return null;
	return (
		<div className="modal-backdrop" onClick={props.onClose}>
			<div className="modal" role="dialog" aria-modal="true" aria-label={props.title} onClick={event => event.stopPropagation()}>
				<header className="card-head">
					<h2>{props.title}</h2>
					<Button kind="ghost" ariaLabel={t("Close")} onClick={props.onClose}>✕</Button>
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
				<Button kind="danger-solid" disabled={props.busy} onClick={props.onConfirm}>{props.confirmLabel}</Button>
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

export function CopyButton(props: { value: string; label?: string }) {
	const t = useT();
	const [copied, setCopied] = useState(false);
	const copy = () => {
		void navigator.clipboard.writeText(props.value).then(() => {
			setCopied(true);
			window.setTimeout(() => setCopied(false), 1600);
		}).catch(() => undefined);
	};
	return (
		<button
			type="button"
			className={`copy-btn ${copied ? "copied" : ""}`}
			onClick={copy}
			aria-label={props.label ?? `${t("Copy")}: ${props.value}`}
		>
			{copied ? t("Copied") : t("Copy")}
		</button>
	);
}

/** Truncated JetBrains Mono identifier with a `<title>` and a CopyButton. */
export function MonoId(props: { value: string; wide?: boolean }) {
	return (
		<span className={`mono-id ${props.wide ? "wide" : ""}`}>
			<span title={props.value}>{props.value}</span>
			<CopyButton value={props.value} />
		</span>
	);
}

/* ---------- toasts ---------- */

type ToastTone = "ok" | "bad";
interface ToastItem { id: number; message: string; tone: ToastTone }

const ToastContext = createContext<(message: string, tone?: ToastTone) => void>(() => undefined);

let toastSeq = 0;

export function ToastProvider(props: { children: ReactNode }) {
	const [items, setItems] = useState<ToastItem[]>([]);
	const push = useCallback((message: string, tone: ToastTone = "ok") => {
		const id = ++toastSeq;
		setItems(current => [...current, { id, message, tone }]);
		window.setTimeout(() => {
			setItems(current => current.filter(item => item.id !== id));
		}, 3500);
	}, []);
	return (
		<ToastContext.Provider value={push}>
			{props.children}
			<div className="toaster" role="status" aria-live="polite">
				{items.map(item => <div key={item.id} className={`toast ${item.tone}`}>{item.message}</div>)}
			</div>
		</ToastContext.Provider>
	);
}

export function useToast() {
	return useContext(ToastContext);
}
