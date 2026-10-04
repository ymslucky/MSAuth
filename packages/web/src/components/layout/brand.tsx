/**
 * 品牌标识（SPEC §3.2 v1.2.5）：「M + 验证点」字标——白色描边 M + 谷底悬浮圆点，
 * M = MSAuth 身份，圆点 = 验证通过/钥匙孔；底块渐变随主题（§3.1.1）。
 */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
      <defs>
        <linearGradient id="msauth-brand" x1="0" y1="0" x2="1" y2="1">
          {/* SVG 属性不支持 var()，经 style 引用主题令牌（内联 style 属性 CSP 允许） */}
          <stop offset="0" style={{ stopColor: 'var(--color-logo-from)' }} />
          <stop offset="1" style={{ stopColor: 'var(--color-logo-to)' }} />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#msauth-brand)" />
      <path
        d="M9.5 21.5 V12.5 L16 17 L22.5 12.5 V21.5"
        fill="none"
        stroke="#ffffff"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="21.5" r="2" fill="#ffffff" />
    </svg>
  );
}

export function Brand({ tagline }: { tagline?: string }) {
  return (
    <div className="flex items-center gap-3">
      <BrandMark />
      <div>
        <div className="font-display text-xl font-bold tracking-tight text-ink">MSAuth</div>
        {tagline && <div className="overline">{tagline}</div>}
      </div>
    </div>
  );
}
