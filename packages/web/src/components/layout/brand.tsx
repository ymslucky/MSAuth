/** 品牌标识：亮蓝渐变圆角方块 + 白色菱形（SPEC §5.2） */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
      <defs>
        <linearGradient id="msauth-blue" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#6366f1" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#msauth-blue)" />
      <path d="M16 7l7.8 9-7.8 9-7.8-9z" fill="#ffffff" />
      <circle cx="16" cy="16" r="2.4" fill="#2563eb" />
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
