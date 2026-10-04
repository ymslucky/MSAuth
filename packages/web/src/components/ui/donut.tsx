/**
 * Donut 环形进度（SPEC §6.8）：纯 SVG，灰轨道 + accent 值弧，入场弧线展开一次。
 * role="img" + 结论性 aria-label（不以颜色为唯一信息载体，WCAG 1.4.1 / 4.1.2）。
 */
import type { CSSProperties, ReactNode } from 'react';

export function Donut({
  percent,
  size = 80,
  stroke = 8,
  color = 'var(--color-action)',
  label,
  children,
}: {
  /** 0–100 */
  percent: number;
  size?: number;
  stroke?: number;
  /** CSS 颜色值（accent primitive / 语义令牌） */
  color?: string;
  /** 结论性描述，如「当前设备 1 / 共 3 个会话」 */
  label: string;
  /** 中心内容（通常为大数字） */
  children?: ReactNode;
}) {
  const p = Math.max(0, Math.min(100, percent));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const arc = (c * p) / 100;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-surface-input)" strokeWidth={stroke} />
        <circle
          className="donut-arc"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${arc} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ '--donut-len': `${c}` } as CSSProperties}
        />
      </svg>
      {children && <div className="absolute inset-0 flex items-center justify-center">{children}</div>}
    </div>
  );
}
