/** Zod 校验辅助：失败统一转 AppError(VALIDATION)，details 为字段级错误列表 */
import { AppError } from '@msauth/shared';
import type { z } from 'zod';

export function parseWith<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new AppError({
      code: 'VALIDATION',
      details: result.error.issues.map((issue) => ({
        path: issue.path.map(String).join('.'),
        message: issue.message,
      })),
    });
  }
  return result.data;
}

/** 安全读取 JSON 请求体：空/坏 JSON 一律交给 schema 报 VALIDATION */
export async function readJsonBody(c: { req: { json(): Promise<unknown> } }): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    return null;
  }
}
