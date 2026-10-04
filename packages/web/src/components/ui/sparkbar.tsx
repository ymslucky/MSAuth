/** Sparkbar（SPEC §6.8）：近 14 天登录活跃堆叠柱，纯 SVG 手写，禁图表库 */
import type { LoginDailyStat } from '@msauth/shared';

const CHART_H = 96; // 最高柱对齐高度
const GAP = 4;

/** 入场动画：柱体自底向上生长一次（CSP 安全纯 CSS，类名在 index.css） */
export function Sparkbar({ data, label }: { data: LoginDailyStat[]; label: string }) {
  const n = data.length || 1;
  const max = Math.max(...data.map((d) => d.success + d.failure), 4);
  // viewBox 宽度按 4 倍密度，柱宽自适应
  const width = n * 24;
  const barW = (width - (n - 1) * GAP * 4) / n;

  return (
    <svg viewBox={`0 0 ${width} ${CHART_H + 20}`} className="w-full" role="img" aria-label={label}>
      {data.map((d, i) => {
        const total = d.success + d.failure;
        const h = (total / max) * CHART_H;
        const x = i * 24;
        const y = CHART_H - h;
        const failH = total > 0 ? (d.failure / max) * CHART_H : 0;
        const showAxis = i % 4 === 0 || i === n - 1;
        return (
          <g key={d.date}>
            <title>{`${d.date.slice(5)} 成功 ${d.success} · 失败 ${d.failure}`}</title>
            {/* 空柱轨道：保持节奏感 */}
            {total === 0 && <rect x={x} y={CHART_H - 4} width={barW} height={4} rx={2} fill="var(--color-line)" />}
            {d.success > 0 && (
              <rect x={x} y={CHART_H - (h - failH)} width={barW} height={h - failH} rx={2} fill="var(--color-action)" className="sparkbar-col" style={{ animationDelay: `${i * 24}ms` }} />
            )}
            {d.failure > 0 && (
              <rect x={x} y={y} width={barW} height={failH} rx={2} fill="var(--color-danger-vivid)" className="sparkbar-col" style={{ animationDelay: `${i * 24}ms` }} />
            )}
            {showAxis && (
              <text x={x + barW / 2} y={CHART_H + 14} textAnchor="middle" className="sparkbar-axis">
                {d.date.slice(5)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
