import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, CircleAlert, Info, X } from "lucide-react";
import { useT, useLang, tMessage } from "./i18n";
import { capVisibleToasts, noticeTtl, type NoticeTone } from "./notice";
import { Confirm } from "./dialog";

/**
 * Unified notice stack — toasts + promise-based destructive confirm. Split
 * from ui.tsx; every page grabs `useNotice()` for toasts and confirms. The
 * context value is memoized so a toast landing never re-renders the tree.
 */

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
	const { lang } = useLang();
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

	// Stable identity: toast/confirm land in state owned here, consumers must
	// not re-render just because this provider re-rendered.
	const contextValue = useMemo<NoticeApi>(() => ({ toast, confirm }), [toast, confirm]);

	return (
		<NoticeContext.Provider value={contextValue}>
			{props.children}
			<div className="toaster" role="status" aria-live="polite">
				{toasts.map(item => {
					const Icon = TOAST_ICONS[item.tone];
					return (
						<div key={item.id} className={`toast ${item.tone}`} onClick={() => dismiss(item.id)}>
							<Icon size={15} strokeWidth={2} aria-hidden />
							<span className="toast-text">{tMessage(item.text, lang)}</span>
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
