/**
 * 确认对话框（SPEC §6.5，ARIA APG Dialog 模式）：
 * role=dialog + aria-modal；打开焦点移入首个可聚焦元素（非破坏性）、Tab 循环、
 * Esc/遮罩关闭、关闭后焦点还原、正文滚动锁定。
 */
import { TriangleAlert } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Button } from './button';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  tone?: 'danger' | 'primary';
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  loading?: boolean;
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  tone = 'danger',
  confirmText = '确认',
  cancelText = '取消',
  onConfirm,
  loading = false,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();

  // 打开：焦点移入 + 锁滚动；卸载：焦点还原
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLElement>('button')?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
      prev?.focus?.();
    };
  }, [open]);

  // Esc 关闭 + Tab 焦点陷阱
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-ink/30 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className="anim-pop card-modal w-full max-w-[420px] rounded-dialog p-6"
      >
        <div className="flex gap-4">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
              tone === 'danger' ? 'bg-danger-bg text-danger' : 'bg-action-subtle text-action'
            }`}
            aria-hidden="true"
          >
            <TriangleAlert size={20} strokeWidth={1.75} />
          </div>
          <div className="min-w-0 pt-0.5">
            <h2 id={titleId} className="t-title">
              {title}
            </h2>
            {description && (
              <div id={descId} className="t-caption mt-1.5">
                {description}
              </div>
            )}
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2.5">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelText}
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
