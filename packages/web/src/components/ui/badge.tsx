/** 徽标（SPEC §6.3）：admin 唯一实底 */
import type { ReactNode } from 'react';

type Tone = 'solid' | 'leaf' | 'neutral' | 'success' | 'danger' | 'warn';

const tones: Record<Tone, string> = {
  solid: 'bg-leaf-600 text-white border-transparent',
  leaf: 'bg-leaf-50 text-leaf-700 border-leaf-100',
  neutral: 'bg-canvas-2 text-ink-3 border-line',
  success: 'bg-leaf-50 text-leaf-700 border-leaf-100',
  danger: 'bg-danger-bg text-danger border-danger/20',
  warn: 'bg-warn-bg text-warn border-warn/25',
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
  if (role === 'member' || role === 'viewer') return <Badge tone="leaf">{role}</Badge>;
  return <Badge tone="neutral">{role}</Badge>;
}
