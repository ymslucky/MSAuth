/** 按钮组件：primary（黄铜实心）/ ghost（细线）/ danger / quiet */
import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'ghost' | 'danger' | 'quiet';

const styles: Record<Variant, string> = {
  primary:
    'bg-brass-400 text-ink-950 font-semibold hover:bg-brass-300 active:bg-brass-500 shadow-[0_1px_0_0_rgb(0_0_0/0.25)_inset,0_8px_24px_-12px_rgb(224_164_88/0.45)]',
  ghost: 'border border-ink-600 text-fog-300 hover:border-brass-500 hover:text-paper',
  danger: 'border border-alarm-400/40 text-alarm-400 hover:border-alarm-400 hover:bg-alarm-400/10',
  quiet: 'text-fog-400 hover:text-paper',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
}

export function Button({ variant = 'primary', loading = false, className = '', disabled, children, ...rest }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" className="opacity-25" />
          <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      )}
      {children}
    </button>
  );
}
