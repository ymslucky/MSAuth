/** 表单字段（SPEC §6.2）：overline 标签 + 焦点光环 + 行内错误（aria 关联） */
import type { InputHTMLAttributes, ReactNode, Ref } from 'react';
import { useId } from 'react';

export interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: ReactNode;
  rightSlot?: ReactNode;
  /** RHF register() 通过展开传入的 ref */
  ref?: Ref<HTMLInputElement>;
}

export function Field({ label, error, hint, rightSlot, className = '', id, ...rest }: FieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = `${inputId}-error`;
  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="overline block">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={`h-11 w-full rounded-xl border bg-surface-input px-3.5 text-sm text-ink placeholder:text-ink-4 transition-[border-color,box-shadow] duration-150 ${
            error
              ? 'border-danger/60'
              : 'border-line hover:border-ink-4/60 focus:border-leaf-300 focus:shadow-[0_0_0_4px_rgb(240_249_243/0.6)]'
          } ${rightSlot ? 'pr-11' : ''} ${className}`}
          {...rest}
        />
        {rightSlot && <div className="absolute top-0 right-1 flex h-11 items-center">{rightSlot}</div>}
      </div>
      {hint && !error && <p className="t-caption">{hint}</p>}
      {error && (
        <p id={errorId} className="t-caption text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
