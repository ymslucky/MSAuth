/** 面板卡片：细线边框 + 可选标题区 */
import type { ReactNode } from 'react';

export function Card({ title, desc, children, className = '' }: {
  title?: ReactNode;
  desc?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-ink-700 bg-ink-900/80 backdrop-blur-sm ${className}`}>
      {(title || desc) && (
        <header className="border-b border-ink-700 px-5 py-4">
          {title && <h2 className="font-display text-lg font-medium text-paper">{title}</h2>}
          {desc && <p className="mt-0.5 text-sm text-fog-400">{desc}</p>}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}
