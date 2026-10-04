/** 认证页布局（SPEC §5.2）：浅灰画布 + 顶部淡蓝光晕 + 白色主卡 */
import type { ReactNode } from 'react';
import { Brand } from './brand';

export function AuthLayout({ title, overline, children, footer }: {
  title: string;
  overline: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="halo-top min-h-dvh">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-14">
        <div className="stagger">
          <div className="mb-10 flex justify-center">
            <Brand tagline="IDENTITY · 统一身份" />
          </div>
          <main className="card rounded-card p-8">
            <p className="overline mb-2">{overline}</p>
            <h1 className="t-display mb-7">{title}</h1>
            {children}
          </main>
          {footer && <div className="mt-6 text-center text-sm text-ink-3">{footer}</div>}
          <p className="mt-10 text-center font-mono text-[10px] tracking-[0.22em] text-ink-4 uppercase">
            msauth · cloudflare workers · oauth 2.1
          </p>
        </div>
      </div>
    </div>
  );
}
