/**
 * CSRF 双提交校验：Cookie（非 HttpOnly，SPA 可读）与 x-csrf-token 头必须一致。
 * 仅作用于变更方法；GET 回调（GitHub OAuth）与 SameSite=Lax 已另行覆盖。
 */
import { AppError, COOKIES } from '@msauth/shared';
import { getCookie } from 'hono/cookie';
import type { MiddlewareHandler } from 'hono';
import { timingSafeEqualStr } from '../lib/crypto';
import type { AppEnv } from '../env';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function csrfGuard(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    if (MUTATING.has(c.req.method)) {
      const cookieToken = getCookie(c, COOKIES.csrf);
      const headerToken = c.req.header('x-csrf-token');
      if (!cookieToken || !headerToken || !timingSafeEqualStr(cookieToken, headerToken)) {
        throw new AppError({ code: 'CSRF_INVALID' });
      }
    }
    await next();
  };
}
