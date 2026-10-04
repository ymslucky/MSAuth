/**
 * 限速：基于 Cloudflare Rate Limiting Binding（wrangler.toml unsafe ratelimit），
 * 按「标签 + CF-Connecting-IP」计数。不用 X-Forwarded-For。
 * binding 未注入的环境（部分测试）自动跳过，不影响功能。
 */
import { AppError } from '@msauth/shared';
import type { MiddlewareHandler } from 'hono';
import type { AppEnv, Env } from '../env';

function ipRateLimit(binding: keyof Env, label: string): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const limiter = c.env[binding] as RateLimit | undefined;
    if (!limiter) {
      await next();
      return;
    }
    const ip = c.req.header('CF-Connecting-IP') ?? 'unknown';
    const result = await limiter.limit({ key: `${label}:${ip}` });
    if (!result.success) {
      throw new AppError({ code: 'RATE_LIMITED' });
    }
    await next();
  };
}

/** /api/auth/login：60 秒 5 次/IP */
export const loginRateLimit = () => ipRateLimit('LOGIN_RATE_LIMITER', 'login');

/** /api/auth/register：与登录共用同一 binding，独立计数 */
export const registerRateLimit = () => ipRateLimit('LOGIN_RATE_LIMITER', 'register');
