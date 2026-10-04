/** 按钮（SPEC §6.1）：primary / secondary / danger / quiet；尺寸 40 / 32 */
import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'quiet';
type Size = 'md' | 'sm';

const variants: Record<Variant, string> = {
  primary:
    'bg-action text-white font-semibold shadow-card hover:bg-action-hover hover:-translate-y-px active:translate-y-0 active:scale-[0.98] transition-[background-color,transform] duration-[140ms]',
  secondary:
    'bg-surface border border-line text-ink-2 font-medium hover:bg-canvas hover:border-ink-4/40 active:scale-[0.98]',
  danger:
    'border border-danger/40 text-danger font-medium hover:bg-danger-bg active:scale-[0.98]',
  quiet: 'text-ink-3 font-medium hover:text-action',
};

const sizes: Record<Size, string> = {
  md: 'h-10 px-4 text-sm',
  sm: 'h-8 px-3 text-[13px]',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className = '',
  disabled,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl transition-colors duration-[140ms] disabled:pointer-events-none disabled:opacity-40 ${variants[variant]} ${sizes[size]} ${className}`}
      aria-disabled={disabled || loading || undefined}
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
