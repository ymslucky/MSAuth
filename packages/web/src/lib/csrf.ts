/** CSRF token 读取：优先读双提交 Cookie，缺失时向 /api/auth/csrf 引导 */
import { COOKIES } from '@msauth/shared';

function readCookie(name: string): string | null {
  for (const part of document.cookie.split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0 && part.slice(0, eq).trim() === name) return part.slice(eq + 1);
  }
  return null;
}

let inflight: Promise<string> | null = null;

/** 获取 CSRF token（变更请求前由 api.ts 自动调用） */
export async function getCsrfToken(): Promise<string> {
  const existing = readCookie(COOKIES.csrf);
  if (existing) return existing;
  inflight ??= fetch('/api/auth/csrf', { credentials: 'include' })
    .then((res) => res.json() as Promise<{ csrfToken: string }>)
    .then(({ csrfToken }) => csrfToken)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}
