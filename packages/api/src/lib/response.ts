/** 统一响应封装：2xx 返回资源本体，错误统一走 AppError + error 中间件 */
import type { Context } from 'hono';

export function ok<T>(c: Context, data: T, status: 200 | 201 = 200) {
  return c.json(data, status);
}

export function noContent(c: Context) {
  return c.body(null, 204);
}

export function redirect(c: Context, location: string, status: 302 | 303 = 302) {
  return c.redirect(location, status);
}
