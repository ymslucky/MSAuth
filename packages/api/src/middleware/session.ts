/**
 * 会话中间件：从 Cookie 解出 ULID → SHA-256 → 查库校验（绝对 + 空闲双过期）→ 注入 user/sessionIdHash。
 * 所有 /api/* 都经过这里；未登录不报错（路由自行 requireAuth）。
 */
import { AppError, COOKIES, SESSION_IDLE_TTL } from '@msauth/shared';
import { getCookie } from 'hono/cookie';
import type { MiddlewareHandler } from 'hono';
import { dbOf, SessionsRepository, UsersRepository } from '../db/repositories';
import { sha256Hex } from '../lib/crypto';
import type { AppEnv } from '../env';

/** 合法 ULID（Crockford Base32，26 位） */
const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;

/** last_seen_at 节流：5 分钟内不重复写库 */
const TOUCH_THRESHOLD_MS = 5 * 60 * 1000;

export function sessionMiddleware(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    c.set('user', null);
    c.set('sessionIdHash', null);
    const raw = getCookie(c, COOKIES.session);
    if (raw && ULID_RE.test(raw)) {
      const idHash = await sha256Hex(raw);
      const sessions = new SessionsRepository(dbOf(c.env));
      const session = await sessions.byIdHash(idHash);
      if (session) {
        const now = Date.now();
        const withinAbsolute = now < session.expiresAt;
        const withinIdle = now - session.lastSeenAt < SESSION_IDLE_TTL * 1000;
        if (withinAbsolute && withinIdle) {
          const user = await new UsersRepository(dbOf(c.env)).getPublicUser(session.userId);
          if (user) {
            c.set('user', user);
            c.set('sessionIdHash', session.id);
            if (now - session.lastSeenAt > TOUCH_THRESHOLD_MS) {
              c.executionCtx.waitUntil(sessions.touch(session.id, now).catch(() => undefined));
            }
          }
        }
      }
    }
    await next();
  };
}

/** 受保护路由专用：无会话直接 401 */
export function requireAuth(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    if (!c.get('user')) {
      throw new AppError({ code: 'UNAUTHORIZED' });
    }
    await next();
  };
}
