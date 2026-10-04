/** 白色悬浮卡片（SPEC §6.3）：.card 大圆角 + 可选头 */
import type { ReactNode } from 'react';

export function Card({
  title,
  desc,
  action,
  children,
  className = '',
  padded = true,
}: {
  title?: ReactNode;
  desc?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={`card rounded-card ${className}`}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            {title && <h2 className="t-title">{title}</h2>}
            {desc && <p className="t-caption mt-0.5">{desc}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={padded ? 'p-5' : ''}>{children}</div>
    </section>
  );
}
