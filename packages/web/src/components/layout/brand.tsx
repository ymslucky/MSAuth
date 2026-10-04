/** 品牌标识：主色渐变圆角方块 + 白色菱形（SPEC §5.2，渐变随主题 §3.1.1） */
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
      <rect width="32" height="32" rx="9" fill="url(#msauth-brand)" />
      <path d="M16 7l7.8 9-7.8 9-7.8-9z" fill="#ffffff" />
      <circle cx="16" cy="16" r="2.4" style={{ fill: 'var(--color-logo-dot)' }} />
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
