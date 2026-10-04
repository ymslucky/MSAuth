/**
 * Toast（SPEC §6.4，ARIA APG Status/Alert）：
 * - 成功 3.5s 自动消失、错误 6s；同屏 ≤3 条
 * - role=status（成功/信息）/ role=alert（错误），满足 WCAG 4.1.3
 * - 只用于动作结果反馈；表单校验错误留在表单内
 */
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

type Tone = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  tone: Tone;
  title: string;
  description?: string;
}

export interface ToastApi {
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const TONES: Record<Tone, { icon: typeof Info; color: string; duration: number; role: 'status' | 'alert' }> = {
  success: { icon: CheckCircle2, color: 'text-leaf-600', duration: 3500, role: 'status' },
  error: { icon: AlertTriangle, color: 'text-danger', duration: 6000, role: 'alert' },
  info: { icon: Info, color: 'text-info', duration: 3500, role: 'status' },
};

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast 必须在 ToastProvider 内使用');
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (tone: Tone, title: string, description?: string) => {
      const id = ++seq.current;
      setItems((prev) => [...prev.slice(-2), { id, tone, title, description }]); // 同屏 ≤3
      window.setTimeout(() => dismiss(id), TONES[tone]!.duration);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (title, description) => push('success', title, description),
      error: (title, description) => push('error', title, description),
      info: (title, description) => push('info', title, description),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed top-5 right-5 z-[200] flex w-[360px] max-w-[calc(100vw-40px)] flex-col gap-2">
        {items.map((item) => {
          const conf = TONES[item.tone]!;
          const Icon = conf.icon;
          return (
            <div key={item.id} role={conf.role} className="anim-toast glass-2 pointer-events-auto flex items-start gap-3 rounded-[14px] p-3.5">
              <Icon size={18} strokeWidth={1.75} className={`mt-0.5 shrink-0 ${conf.color}`} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-5 font-semibold text-ink">{item.title}</p>
                {item.description && <p className="t-caption mt-0.5">{item.description}</p>}
              </div>
              <button
                type="button"
                aria-label="关闭通知"
                onClick={() => dismiss(item.id)}
                className="rounded-md p-1 text-ink-4 transition-colors hover:text-ink"
              >
                <X size={14} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
