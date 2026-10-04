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

/**
 * CSRF 豁免路径：RFC 6749 表单端点（/api/oauth/token）不依赖 Cookie 鉴权
 * （公共客户端靠 PKCE/一次性授权码自证），双提交校验不适用。
 */
const CSRF_EXEMPT = new Set(['/api/oauth/token']);

export function csrfGuard(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    if (MUTATING.has(c.req.method) && !CSRF_EXEMPT.has(c.req.path)) {
      const cookieToken = getCookie(c, COOKIES.csrf);
      const headerToken = c.req.header('x-csrf-token');
      if (!cookieToken || !headerToken || !timingSafeEqualStr(cookieToken, headerToken)) {
        throw new AppError({ code: 'CSRF_INVALID' });
      }
    }
    await next();
  };
}
