/** 品牌标识：自然绿渐变菱形 + Sora 字标 */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
      <defs>
        <linearGradient id="msauth-leaf" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3ba76e" />
          <stop offset="1" stopColor="#237048" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="#ffffff" fillOpacity="0.7" stroke="#2c8a58" strokeOpacity="0.25" />
      <path d="M16 6.5l8.5 9.5-8.5 9.5L7.5 16z" fill="none" stroke="url(#msauth-leaf)" strokeWidth="2.2" />
      <circle cx="16" cy="16" r="2.6" fill="url(#msauth-leaf)" />
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
