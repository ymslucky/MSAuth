import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { useT } from "./i18n";
import { Button } from "./ui";

/**
 * Dialog primitives: focus-trapped modal (Escape closes, focus returns to the
 * trigger) and the styled destructive-confirmation body that composes it.
 * Split from ui.tsx so the shared-primitives module stays lean; pages import
 * Modal from here, the notice stack composes Confirm.
 */
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
