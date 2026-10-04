/** 404（SPEC §7.10） */
import { Compass } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="halo-top flex min-h-dvh flex-col items-center justify-center px-4">
      <div className="card anim-pop flex max-w-sm flex-col items-center rounded-card px-10 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-action-subtle text-action">
          <Compass size={24} strokeWidth={1.75} aria-hidden="true" />
        </div>
        <p className="overline mt-4">ERROR · 404</p>
        <h1 className="t-title mt-1.5">页面不存在</h1>
        <p className="t-caption mt-1.5">你要访问的地址不在 MSAuth 中，可能已被移动或从未存在。</p>
        <Link
          to="/account"
          className="mt-5 inline-flex h-10 items-center rounded-xl bg-action px-4 text-sm font-semibold text-white shadow-card transition-colors duration-[140ms] hover:bg-action-hover"
        >
          返回账户
        </Link>
      </div>
    </div>
  );
}
