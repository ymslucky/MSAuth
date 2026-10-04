/** 表单字段：label + input + 错误信息 */
import type { InputHTMLAttributes, ReactNode } from 'react';
import { useId } from 'react';

export interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: ReactNode;
}

export function Field({ label, error, hint, className = '', id, ...rest }: FieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="overline block">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        className={`w-full rounded-lg border bg-ink-850 px-3 py-2.5 text-sm text-paper placeholder:text-fog-500 ${
          error ? 'border-alarm-400/60' : 'border-ink-600 hover:border-ink-500 focus:border-brass-400'
        } transition-colors ${className}`}
        {...rest}
      />
      {hint && !error && <p className="text-xs text-fog-500">{hint}</p>}
      {error && <p className="font-mono text-xs text-alarm-400">{error}</p>}
    </div>
  );
}
