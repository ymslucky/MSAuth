/**
 * 认证相关输入 schema：注册、登录。
 * API 路由与 SPA 表单共用同一份定义（react-hook-form + zodResolver）。
 */
import { z } from 'zod';
import { PASSWORD_POLICY } from '../constants';

/** 邮箱：先规范化（去首尾空白、转小写），再校验格式；长度上限 254（RFC 5321） */
export const emailSchema = z
  .string({ message: '请输入邮箱' })
  .trim()
  .toLowerCase()
  .max(254, '邮箱地址过长')
  .pipe(z.email({ message: '邮箱格式不正确' }));

export type Email = z.infer<typeof emailSchema>;

/**
 * 注册密码：只限制长度，不做复杂度要求（NIST SP 800-63B）。
 * 哈希使用 Web Crypto PBKDF2（api/modules/auth/password.ts）。
 */
export const passwordSchema = z
  .string({ message: '请输入密码' })
  .min(PASSWORD_POLICY.minLength, `密码至少 ${PASSWORD_POLICY.minLength} 个字符`)
  .max(PASSWORD_POLICY.maxLength, `密码最多 ${PASSWORD_POLICY.maxLength} 个字符`);

/** 登录密码：只要求非空，不做强度校验（避免登录路径泄露密码策略） */
const loginPasswordSchema = z
  .string({ message: '请输入密码' })
  .min(1, '请输入密码')
  .max(PASSWORD_POLICY.maxLength, '密码过长');

/** 显示名：trim 后 1–64 字符，不做字符白名单（家人朋友场景） */
const displayNameSchema = z
  .string({ message: '请输入显示名' })
  .trim()
  .min(1, '显示名不能为空')
  .max(64, '显示名最多 64 个字符');

/** POST /api/auth/login 请求体（strict：拒绝未知字段） */
export const loginSchema = z.strictObject({
  email: emailSchema,
  password: loginPasswordSchema,
});
export type LoginInput = z.infer<typeof loginSchema>;

/** POST /api/auth/register 请求体（strict：拒绝未知字段） */
export const registerSchema = z.strictObject({
  email: emailSchema,
  password: passwordSchema,
  displayName: displayNameSchema,
});
export type RegisterInput = z.infer<typeof registerSchema>;
