import type { ReactNode } from "react";

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

export function Button(props: { onClick?: () => void; kind?: "primary" | "danger" | "ghost"; disabled?: boolean; children: ReactNode }) {
	return (
		<button type="button" className={`btn ${props.kind ?? ""}`} onClick={props.onClick} disabled={props.disabled}>
			{props.children}
		</button>
	);
}

export function Field(props: { label: string; children: ReactNode; hint?: string }) {
	return (
		<label className="field">
			<span>{props.label}</span>
			{props.children}
			{props.hint && <small>{props.hint}</small>}
		</label>
	);
}

export function Badge(props: { tone?: "ok" | "warn" | "bad"; children: ReactNode }) {
	return <span className={`badge ${props.tone ?? ""}`}>{props.children}</span>;
}

export function ErrorNote(props: { message?: string | null }) {
	if (!props.message) return null;
	return <p className="error-note" role="alert">{props.message}</p>;
}

export function Empty(props: { children: ReactNode }) {
	return <p className="empty">{props.children}</p>;
}

export function Table(props: { head: string[]; children: ReactNode }) {
	return (
		<div className="table-wrap">
			<table>
				<thead>
					<tr>{props.head.map(head => <th key={head}>{head}</th>)}</tr>
				</thead>
				<tbody>{props.children}</tbody>
			</table>
		</div>
	);
}

export function Modal(props: { title: string; open: boolean; onClose: () => void; children: ReactNode }) {
	if (!props.open) return null;
	return (
		<div className="modal-backdrop" onClick={props.onClose}>
			<div className="modal" role="dialog" aria-label={props.title} onClick={event => event.stopPropagation()}>
				<header className="card-head">
					<h2>{props.title}</h2>
					<Button kind="ghost" onClick={props.onClose}>✕</Button>
				</header>
				{props.children}
			</div>
		</div>
	);
}

export function Stat(props: { label: string; value: ReactNode }) {
	return (
		<div className="stat">
			<strong>{props.value}</strong>
			<span>{props.label}</span>
		</div>
	);
}
