/** 按钮（SPEC §6.1 v1.3，M3 变体）：filled / tonal / danger-tonal / text；胶囊形，尺寸 40 / 32 */
import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'quiet';
type Size = 'md' | 'sm';

const variants: Record<Variant, string> = {
  // M3 filled：主色实底 + hover 抬升轻影
  primary:
    'bg-action text-white font-semibold hover:bg-action-hover hover:shadow-card active:scale-[0.98] transition-[background-color,box-shadow,transform] duration-150',
  // M3 tonal：primary-container 底 + on-primary-container 文字
  secondary: 'bg-action-subtle text-action-hover font-medium m3-tonal-hover active:scale-[0.98]',
  // M3 tonal（error）
  danger: 'bg-danger-bg text-danger font-medium m3-danger-tonal-hover active:scale-[0.98]',
  // M3 text：主色文字 + 状态层
  quiet: 'text-action font-medium m3-state-primary',
};

const sizes: Record<Size, string> = {
  md: 'h-10 px-5 text-sm',
  sm: 'h-8 px-4 text-[13px]',
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
      className={`inline-flex items-center justify-center gap-2 rounded-full transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40 ${variants[variant]} ${sizes[size]} ${className}`}
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
