/** 品牌标识：黄铜菱形 + 字标 */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
      <rect width="32" height="32" rx="7" fill="#12151b" stroke="#2a2f3a" />
      <path d="M16 6l9 10-9 10-9-10z" fill="none" stroke="#e0a458" strokeWidth="2.2" />
      <circle cx="16" cy="16" r="2.6" fill="#e0a458" />
    </svg>
  );
}

export function Brand({ tagline }: { tagline?: string }) {
  return (
    <div className="flex items-center gap-3">
      <BrandMark />
      <div>
        <div className="font-display text-xl font-semibold tracking-tight text-paper">MSAuth</div>
        {tagline && <div className="overline">{tagline}</div>}
      </div>
    </div>
  );
}
