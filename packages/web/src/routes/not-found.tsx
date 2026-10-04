/** 404 */
import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="vault-bg flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="font-mono text-[11px] tracking-[0.22em] text-fog-500 uppercase">error · 404</p>
      <h1 className="font-display text-4xl font-semibold text-paper">页面不存在</h1>
      <p className="max-w-sm text-sm text-fog-400">你要访问的地址不在 MSAuth 中，可能已被移动或从未存在。</p>
      <Link
        to="/account"
        className="rounded-lg border border-brass-400/40 px-4 py-2 text-sm text-brass-300 transition-colors hover:bg-brass-400/10"
      >
        返回账户
      </Link>
    </div>
  );
}
