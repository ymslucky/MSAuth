/**
 * OAuth 2.1 相关输入 schema：授权端点查询、同意决定、客户端注册。
 * API 路由与 SPA 共用；wire 字段名保持 RFC 6749 惯例（snake_case）。
 */
import { z } from 'zod';
import { SCOPE_LIST, TTL_LIMITS } from '../constants';

/** 绝对 http(s) URL（redirect_uri / resource 共用；拒绝相对路径与其他协议） */
const absoluteHttpUrl = z.url({ protocol: /^https?$/, message: '必须是 http(s) 绝对 URL' });

/** code_verifier / code_challenge：base64url 字符集，43–128 字符（RFC 7636） */
const pkceParam = z
  .string({ message: '缺少 PKCE 参数' })
  .regex(/^[A-Za-z0-9_-]{43,128}$/, 'code_challenge 必须是 43–128 位的 base64url 字符串');

/** GET /api/oauth/authorize 查询参数（strict：拒绝未知字段） */
export const authorizeQuerySchema = z.strictObject({
  response_type: z.literal('code', { message: 'response_type 只支持 code' }),
  client_id: z.string({ message: '缺少 client_id' }).min(1),
  redirect_uri: absoluteHttpUrl,
  /** 空格分隔的请求 scope */
  scope: z.string({ message: '缺少 scope' }).trim().min(1, '缺少 scope').max(1024),
  state: z.string().max(2048, 'state 过长').optional(),
  code_challenge: pkceParam,
  code_challenge_method: z.literal('S256', { message: 'code_challenge_method 只支持 S256' }),
  resource: absoluteHttpUrl.optional(),
});
export type AuthorizeQuery = z.infer<typeof authorizeQuerySchema>;

/** POST /api/oauth/consent 请求体 */
export const consentDecisionSchema = z.strictObject({
  request_id: z.string({ message: '缺少 request_id' }).min(1),
  approve: z.boolean({ message: '缺少 approve' }),
});
export type ConsentDecision = z.infer<typeof consentDecisionSchema>;

/** POST /api/admin/clients 请求体（管理端注册客户端） */
export const clientCreateSchema = z.strictObject({
  name: z
    .string({ message: '请输入客户端名称' })
    .trim()
    .min(1, '名称不能为空')
    .max(64, '名称最多 64 个字符'),
  redirect_uris: z
    .array(absoluteHttpUrl, { message: 'redirect_uris 必须是绝对 URL 数组' })
    .min(1, '至少注册一个回调地址')
    .max(8, '回调地址最多 8 个'),
  allowed_scopes: z
    .array(z.enum(SCOPE_LIST), { message: 'allowed_scopes 含未注册的 scope' })
    .min(1, '至少允许一个 scope')
    .max(SCOPE_LIST.length),
  resource: absoluteHttpUrl,
  access_token_ttl_seconds: z
    .number({ message: 'access_token_ttl_seconds 必须是整数' })
    .int()
    .min(TTL_LIMITS.accessToken.min, `访问令牌 TTL 最小 ${TTL_LIMITS.accessToken.min} 秒`)
    .max(TTL_LIMITS.accessToken.max, `访问令牌 TTL 最大 ${TTL_LIMITS.accessToken.max} 秒`)
    .optional(),
  refresh_token_ttl_seconds: z
    .number({ message: 'refresh_token_ttl_seconds 必须是整数' })
    .int()
    .min(TTL_LIMITS.refreshToken.min, `刷新令牌 TTL 最小 ${TTL_LIMITS.refreshToken.min} 秒`)
    .max(TTL_LIMITS.refreshToken.max, `刷新令牌 TTL 最大 ${TTL_LIMITS.refreshToken.max} 秒`)
    .optional(),
});
export type ClientCreateInput = z.infer<typeof clientCreateSchema>;
