/** 认证页布局（SPEC §5.1）：加强环境光 + 品牌区 + 玻璃主卡 */
import type { ReactNode } from 'react';
import { Brand } from './brand';

export function AuthLayout({ title, overline, children, footer }: {
  title: string;
  overline: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="ambient-max min-h-dvh">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
        <div className="stagger">
          <div className="mb-8 flex justify-center">
            <Brand tagline="IDENTITY · 统一身份" />
          </div>
          <main className="glass-1 rounded-card p-7">
            <p className="overline mb-1.5">{overline}</p>
            <h1 className="t-display mb-6">{title}</h1>
            {children}
          </main>
          {footer && <div className="mt-5 text-center text-sm text-ink-3">{footer}</div>}
          <p className="mt-8 text-center font-mono text-[10px] tracking-[0.22em] text-ink-4 uppercase">
            msauth · cloudflare workers · oauth 2.1
          </p>
        </div>
      </div>
    </div>
  );
}
