/** 骨架屏占位（SPEC §6.3）：shape 由 className 决定 */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton ${className}`} />;
}
