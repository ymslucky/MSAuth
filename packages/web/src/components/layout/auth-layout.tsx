/** 认证页布局：点阵背景 + 居中卡片 */
import type { ReactNode } from 'react';
import { Brand } from './brand';

export function AuthLayout({ title, overline, children, footer }: {
  title: string;
  overline: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="vault-bg min-h-dvh">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
        <div className="anim-rise mb-8 flex flex-col items-center gap-3">
          <Brand tagline="IDENTITY · 统一身份" />
        </div>
        <main className="anim-rise-2 rounded-2xl border border-ink-700 bg-ink-900/85 p-7 shadow-[0_24px_80px_-32px_rgb(0_0_0/0.8)] backdrop-blur">
          <p className="overline mb-1">{overline}</p>
          <h1 className="font-display mb-6 text-2xl font-semibold tracking-tight text-paper">{title}</h1>
          {children}
        </main>
        {footer && <div className="anim-rise-3 mt-5 text-center text-sm text-fog-500">{footer}</div>}
        <p className="mt-8 text-center font-mono text-[10px] tracking-[0.22em] text-fog-500/70 uppercase">
          msauth · cloudflare workers · oauth 2.1
        </p>
      </div>
    </div>
  );
}
