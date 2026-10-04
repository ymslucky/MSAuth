/** 徽标（SPEC §6.3）：admin 唯一实底；语义色用文字级保证对比度 */
import type { ReactNode } from 'react';

type Tone = 'solid' | 'blue' | 'neutral' | 'success' | 'danger' | 'warn' | 'info' | 'purple';

const tones: Record<Tone, string> = {
  solid: 'bg-action text-white border-transparent',
  blue: 'bg-action-subtle text-action-hover border-action/15',
  neutral: 'bg-canvas text-ink-3 border-line',
  success: 'bg-success-bg text-success border-success/20',
  danger: 'bg-danger-bg text-danger border-danger/20',
  warn: 'bg-warning-bg text-warning border-warning/25',
  info: 'bg-info-bg text-info border-info/20',
  purple: 'bg-accent-purple-bg text-accent-purple border-accent-purple/20',
};

export function Badge({ tone = 'neutral', dot = false, children }: { tone?: Tone; dot?: boolean; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 font-mono text-[11px] leading-[16px] ${tones[tone]}`}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />}
      {children}
    </span>
  );
}

/** 角色徽标映射 */
export function RoleBadge({ role }: { role: string }) {
  if (role === 'admin') return <Badge tone="solid">admin</Badge>;
  if (role === 'member' || role === 'viewer') return <Badge tone="blue">{role}</Badge>;
  return <Badge tone="neutral">{role}</Badge>;
}
