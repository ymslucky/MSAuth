/**
 * AreaTrend（SPEC §6.8 v1.2.6，编辑感图表语法）：近 14 天登录活跃平滑曲线 + 渐变面积，纯 SVG 手写。
 * 视觉语法（参考 lieflat-charts Mono/Lupi）：发丝线网格 + 可数刻度（1 格 = 1 次）+
 * 真实单位旁注 + 峰值旁注（锚右上）+ 末值标注 + 受控视线落点（失败日以基线红点标记，仅实有失败时）。
 *
 * 尺寸策略：ResizeObserver 量取容器宽 → viewBox 宽 = 容器实际像素宽，
 * 渲染比例恒为 1:1，mono 文字不随卡片宽度缩放。
 */
import type { LoginDailyStat } from '@msauth/shared';
import { useEffect, useRef, useState } from 'react';

const N = 14; // 固定 14 天
const PAD_L = 30; // 左轴刻度留白
const PAD_R = 8; // 右侧留白
const TOP = 20; // 顶部旁注区
const H = 84; // 曲线区高度
const BASE = TOP + H; // 基线 y
const AXIS_Y = BASE + 15; // 日期轴 y
const TOTAL_H = AXIS_Y + 6; // viewBox 总高
const MIN_W = 340; // 最小逻辑宽（低于此整体等比缩小）

interface Pt {
  x: number;
  y: number;
}

/** Catmull-Rom → 三次贝塞尔平滑曲线；控制点 y 夹紧在绘图区内防止过冲 */
function smoothPath(pts: Pt[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${(pts[0] as Pt).x} ${(pts[0] as Pt).y}`;
  const first = pts[0] as Pt; // 上方长度守卫保证存在
  const clampY = (y: number) => Math.min(BASE, Math.max(TOP, y));
  let d = `M ${first.x} ${first.y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i] as Pt; // 循环边界保证存在
    const p2 = pts[i + 1] as Pt;
    const p0 = pts[i - 1] ?? p1; // 首段前导点回退
    const p3 = pts[i + 2] ?? p2; // 末段后继点回退
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = clampY(p1.y + (p2.y - p0.y) / 6);
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = clampY(p2.y - (p3.y - p1.y) / 6);
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

export function AreaTrend({ data, label }: { data: LoginDailyStat[]; label: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [boxW, setBoxW] = useState(0);

  // 量取容器宽度，驱动 viewBox 与容器 1:1 对齐
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cw = entries[0]?.contentRect.width;
      if (cw) setBoxW(cw);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const W = Math.max(boxW, MIN_W);
  const xOf = (i: number) => PAD_L + (i * (W - PAD_L - PAD_R)) / (N - 1);

  const totals = data.map((d) => d.success + d.failure);
  const max = Math.max(...totals, 4);
  // 可数刻度：刻度步长保证整数格（1 格 = step 次）
  const step = max <= 6 ? 1 : max <= 12 ? 2 : 5;
  const scaleMax = Math.ceil(max / step) * step;
  const yOf = (v: number) => BASE - (v / scaleMax) * H;

  const pts = totals.map((v, i) => ({ x: xOf(i), y: yOf(v) }));
  const lineD = smoothPath(pts);
  const areaD = `${lineD} L ${xOf(N - 1)} ${BASE} L ${xOf(0)} ${BASE} Z`;

  // 峰值与末值旁注
  const peakIdx = totals.indexOf(Math.max(...totals));
  const peak = totals[peakIdx] ?? 0;
  const last = totals[N - 1] ?? 0;

  return (
    <div ref={boxRef} className="w-full">
      <svg viewBox={`0 0 ${W} ${TOTAL_H}`} width="100%" role="img" aria-label={label}>
        <defs>
          {/* 面积渐变：action 0.16 → 0（SVG 属性不支持 var()，经 style 引用主题令牌） */}
          <linearGradient id="msauth-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: 'var(--color-action)', stopOpacity: 0.16 }} />
            <stop offset="1" style={{ stopColor: 'var(--color-action)', stopOpacity: 0 }} />
          </linearGradient>
        </defs>

        {/* 发丝线网格 + 可数左轴（mono 数字，真实单位） */}
        {Array.from({ length: scaleMax / step }, (_, i) => {
          const v = (i + 1) * step;
          const y = yOf(v);
          return (
            <g key={v}>
              <line x1={PAD_L} x2={W - PAD_R} y1={y} y2={y} stroke="var(--color-line)" strokeWidth={1} />
              <text x={PAD_L - 6} y={y + 3.5} textAnchor="end" className="chart-tick">
                {v}
              </text>
            </g>
          );
        })}
        {/* 基线 + 单位旁注（图左上角） */}
        <line x1={PAD_L} x2={W - PAD_R} y1={BASE} y2={BASE} stroke="var(--color-ink-4)" strokeWidth={1} />
        <text x={PAD_L} y={TOP - 8} className="chart-tick">
          次/日
        </text>

        {/* 渐变面积 + 平滑曲线（描线生长入场） */}
        <path d={areaD} fill="url(#msauth-area)" className="area-fill" />
        <path
          d={lineD}
          fill="none"
          stroke="var(--color-action)"
          strokeWidth={2}
          strokeLinecap="round"
          pathLength={1}
          className="area-line"
        />

        {/* 基线失败事件点：受控视线落点，仅实有失败的日期出现 */}
        {data.map((d, i) =>
          d.failure > 0 ? (
            <circle key={`f-${d.date}`} cx={xOf(i)} cy={BASE - 2.5} r={2.5} fill="var(--color-danger-vivid)" className="area-dot" />
          ) : null,
        )}

        {/* 逐日顶点小点 + 末值强调（白描边空心点 + mono 末值标注） */}
        {pts.map((pt, i) => {
          const v = totals[i] ?? 0;
          return v > 0 ? (
            <circle key={`p-${data[i]?.date ?? i}`} cx={pt.x} cy={pt.y} r={2.5} fill="var(--color-action)" stroke="var(--color-surface)" strokeWidth={1.5} className="area-dot" />
          ) : null;
        })}
        {last > 0 && (
          <text x={xOf(N - 1)} y={yOf(last) - 8} textAnchor="end" className="chart-axis" fill="var(--color-ink-2)">
            {last}
          </text>
        )}

        {/* 账本式逐日刻度 + 日期标签（下标 1,4,7,10,13，末日在列、间距 3 格不重叠） */}
        {data.map((d, i) => (
          <g key={`a-${d.date}`}>
            <line x1={xOf(i)} x2={xOf(i)} y1={BASE} y2={BASE + 3} stroke="var(--color-line)" strokeWidth={1} />
            {i % 3 === 1 && (
              <text x={xOf(i)} y={AXIS_Y} textAnchor="middle" className="chart-axis">
                {d.date.slice(5)}
              </text>
            )}
          </g>
        ))}

        {/* 逐日悬浮列（透明命中区）+ 峰值旁注（锚图右上，与左上单位注记不相撞） */}
        {data.map((d, i) => {
          const half = (W - PAD_L - PAD_R) / (N - 1) / 2;
          return (
            <rect
              key={`h-${d.date}`}
              x={xOf(i) - half}
              y={TOP}
              width={half * 2}
              height={H}
              fill="transparent"
            >
              <title>{`${d.date.slice(5)} 成功 ${d.success} · 失败 ${d.failure}`}</title>
            </rect>
          );
        })}
        {peak > 0 && (
          <text x={W - PAD_R} y={TOP - 8} textAnchor="end" className="chart-note">
            {`峰值 ${peak} 次 · ${(data[peakIdx] ?? { date: '' }).date.slice(5)}`}
          </text>
        )}
      </svg>
    </div>
  );
}
