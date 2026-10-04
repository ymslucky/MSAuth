/**
 * 账户自助相关输入 schema。
 */
import { z } from 'zod';
import { PASSWORD_POLICY } from '../constants';
import { passwordSchema } from './auth';

/**
 * POST /api/account/password 请求体。
 * currentPassword 允许空串：GitHub-only 用户（未设过密码）首次设置密码时无需当前密码。
 */
export const changePasswordSchema = z.strictObject({
  currentPassword: z
    .string({ message: '请输入当前密码' })
    .max(PASSWORD_POLICY.maxLength, '当前密码过长'),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
