/** 空态（SPEC §6.3）：blue-50 图标容器 + 标题 + 一句话 + 主操作 */
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function EmptyState({ icon: Icon, title, desc, action }: { icon: LucideIcon; title: string; desc?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-action-subtle text-action">
        <Icon size={24} strokeWidth={1.75} aria-hidden="true" />
      </div>
      <h3 className="t-title mt-1">{title}</h3>
      {desc && <p className="t-caption max-w-xs">{desc}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
