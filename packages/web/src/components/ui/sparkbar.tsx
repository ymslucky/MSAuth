/**
 * Sparkbar（SPEC §6.8，编辑感图表语法 v1.2.5）：近 14 天登录活跃堆叠柱，纯 SVG 手写。
 * 视觉语法（参考 lieflat-charts Mono）：发丝线网格 + 可数刻度（1 格 = 1 次）+
 * 真实单位旁注 + 账本式逐日刻度 + 峰值旁注 + 受控视线落点（失败红仅实有失败时）。
 */
import type { LoginDailyStat } from '@msauth/shared';

const N = 14; // 固定 14 天
const CELL = 24; // 每日横向单元
const PAD_L = 30; // 左轴刻度留白
const TOP = 20; // 顶部旁注区
const H = 84; // 最高柱对齐高度
const BASE = TOP + H; // 基线 y
const W = PAD_L + N * CELL; // 画布宽
const AXIS_Y = BASE + 15; // 日期轴 y
const GAP = 4; // 柱间距

export function Sparkbar({ data, label }: { data: LoginDailyStat[]; label: string }) {
  const totals = data.map((d) => d.success + d.failure);
  const max = Math.max(...totals, 4);
  // 可数刻度：刻度步长保证整数格（1 格 = step 次）
  const step = max <= 6 ? 1 : max <= 12 ? 2 : 5;
  const scaleMax = Math.ceil(max / step) * step;
  const barW = CELL - GAP;
  const yOf = (v: number) => BASE - (v / scaleMax) * H;

  // 峰值旁注：最高日的真实计数 + 日期
  const peakIdx = totals.indexOf(Math.max(...totals));
  const peak = totals[peakIdx] ?? 0;

  return (
    <svg viewBox={`0 0 ${W} ${AXIS_Y + 6}`} className="w-full" role="img" aria-label={label}>
      {/* 发丝线网格 + 可数左轴（mono 数字，真实单位） */}
      {Array.from({ length: scaleMax / step }, (_, i) => {
        const v = (i + 1) * step;
        const y = yOf(v);
        return (
          <g key={v}>
            <line x1={PAD_L} x2={W} y1={y} y2={y} stroke="var(--color-line)" strokeWidth={1} />
            <text x={PAD_L - 6} y={y + 3.5} textAnchor="end" className="sparkbar-tick">
              {v}
            </text>
          </g>
        );
      })}
      {/* 基线 + 单位旁注（图左上角） */}
      <line x1={PAD_L} x2={W} y1={BASE} y2={BASE} stroke="var(--color-ink-4)" strokeWidth={1} />
      <text x={PAD_L} y={TOP - 8} className="sparkbar-tick">
        次/日
      </text>
      {data.map((d, i) => {
        const total = d.success + d.failure;
        const x = PAD_L + i * CELL + GAP / 2;
        const h = total > 0 ? (total / scaleMax) * H : 0;
        const failH = total > 0 ? (d.failure / scaleMax) * H : 0;
        const showAxis = i % 4 === 0 || i === N - 1;
        return (
          <g key={d.date}>
            <title>{`${d.date.slice(5)} 成功 ${d.success} · 失败 ${d.failure}`}</title>
            {total === 0 ? (
              /* 空日：基线上 3px 圆点轨道，保持节奏 */
              <rect x={x} y={BASE - 3} width={barW} height={3} rx={1.5} fill="var(--color-line)" />
            ) : (
              <>
                <rect
                  x={x}
                  y={yOf(d.success)}
                  width={barW}
                  height={h - failH}
                  rx={2}
                  fill="var(--color-action)"
                  className="sparkbar-col"
                  style={{ animationDelay: `${i * 24}ms` }}
                />
                {d.failure > 0 && (
                  <rect
                    x={x}
                    y={BASE - h}
                    width={barW}
                    height={failH}
                    rx={2}
                    fill="var(--color-danger-vivid)"
                    className="sparkbar-col"
                    style={{ animationDelay: `${i * 24}ms` }}
                  />
                )}
              </>
            )}
            {/* 账本式逐日刻度 */}
            <line x1={x + barW / 2} x2={x + barW / 2} y1={BASE} y2={BASE + 3} stroke="var(--color-line)" strokeWidth={1} />
            {showAxis && (
              <text x={x + barW / 2} y={AXIS_Y} textAnchor="middle" className="sparkbar-axis">
                {d.date.slice(5)}
              </text>
            )}
          </g>
        );
      })}
      {/* 峰值旁注（mono 注记，不引入新颜色） */}
      {peak > 0 && (
        <text
          x={Math.min(Math.max(PAD_L + peakIdx * CELL + CELL / 2, PAD_L + 26), W - 30)}
          y={TOP - 8}
          textAnchor="middle"
          className="sparkbar-note"
        >
          {`峰值 ${peak} 次 · ${(data[peakIdx] ?? { date: '' }).date.slice(5)}`}
        </text>
      )}
    </svg>
  );
}
