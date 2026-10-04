/** 全局错误兜底：AppError → 统一 JSON；未知异常 → 500 且不泄露内部细节 */
import { isAppError } from '@msauth/shared';
import type { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { AppEnv } from '../env';

export function registerErrorHandler(app: Hono<AppEnv>): void {
  app.onError((err, c) => {
    if (isAppError(err)) {
      if (err.status >= 500) {
        console.error(`[msauth] ${c.get('requestId')} AppError(5xx) ${err.code}:`, err.message, err.cause ?? '');
      }
      return c.json(err.toJSON(), err.status as ContentfulStatusCode);
    }
    console.error(`[msauth] ${c.get('requestId')} unhandled:`, err);
    return c.json({ error: 'internal_error', message: '服务器内部错误，请稍后再试' }, 500);
  });

  app.notFound((c) => c.json({ error: 'not_found', message: '资源不存在' }, 404));
}
