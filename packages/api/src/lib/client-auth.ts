/**
 * OAuth 客户端认证（RFC 6749 §2.3）：机密客户端 secret 生成 + 令牌端点身份解析。
 *
 * 约定：
 * - secret 本体绝不落库：generateClientSecret 产生的明文只在创建/轮换响应中
 *   一次性下发，库中只存整串的 SHA-256 hex（与授权码 / 刷新令牌同一约定）。
 * - authenticateClient 是 /api/oauth/token 各授权模式的统一入口：
 *   confidential 必须完成客户端认证，public 维持 client_id 明文自报
 *   （PKCE / 一次性授权码 / RT 哈希仍是其安全根）。
 */
import { AppError } from '@msauth/shared';
import type { Context } from 'hono';
import { OAuthClientsRepository, type ClientAuthRecord, dbOf } from '../db/repositories';
import type { AppEnv } from '../env';
import { randomToken, sha256Hex, timingSafeEqualStr } from './crypto';

/** authenticateClient 结果：client 为已查库的客户端，authed 表示是否通过了 secret 客户端认证 */
export interface ClientAuthResult {
  client: ClientAuthRecord;
  authed: boolean;
}

/** 生成机密客户端 secret：'cs_' + base64url(32B)，本体即 crypto.ts 的 randomToken(32) */
export function generateClientSecret(): string {
  return `cs_${randomToken(32)}`;
}

/** 表单/JSON 值宽松取字符串（RFC 6749 表单端点） */
function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * Basic 凭证值 percent-decode：RFC 6749 §2.3.1 要求两值先按 form-urlencoded
 * 编码再拼接 base64，服务端解码后需还原；非法百分号序列容错回原文。
 */
function pctDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** 解码 Basic 凭证（兼容标准 base64 与 base64url 字母表，容忍缺失 padding） */
function decodeBasicCredential(encoded: string): string {
  const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
  return atob(normalized + '='.repeat((4 - (normalized.length % 4)) % 4));
}

/**
 * 解析并认证令牌端点的客户端身份（优先级：Basic 头 > body 自报）：
 * 1. Authorization: Basic（client_secret_basic）：
 *    base64/base64url(percent-encoded(client_id):percent-encoded(client_secret))
 * 2. form/JSON body 的 client_id + client_secret（client_secret_post）
 * - confidential：必须携带 secret 且 sha256Hex 后与库中哈希 timing-safe 相等，
 *   否则 invalid_client(401)
 * - public：无 secret（带了也宽松忽略），维持 client_id 明文自报
 */
export async function authenticateClient(
  c: Context<AppEnv>,
  form: Record<string, unknown>,
): Promise<ClientAuthResult> {
  let clientId = str(form.client_id);
  let clientSecret = str(form.client_secret);

  const basic = c.req.header('authorization');
  if (basic !== undefined && basic.startsWith('Basic ')) {
    let decoded: string;
    try {
      decoded = decodeBasicCredential(basic.slice(6).trim());
    } catch {
      throw new AppError({ code: 'INVALID_CLIENT', message: 'Basic 凭证不是合法的 base64' });
    }
    const sep = decoded.indexOf(':');
    if (sep < 0) throw new AppError({ code: 'INVALID_CLIENT', message: 'Basic 凭证缺少 client_secret' });
    clientId = pctDecode(decoded.slice(0, sep));
    clientSecret = pctDecode(decoded.slice(sep + 1));
  }

  if (!clientId) throw new AppError({ code: 'INVALID_CLIENT', message: '缺少 client_id' });

  const client = await new OAuthClientsRepository(dbOf(c.env)).byIdWithSecret(clientId);
  if (!client) throw new AppError({ code: 'INVALID_CLIENT' });

  if (client.clientType === 'confidential') {
    const matched =
      clientSecret !== '' &&
      client.clientSecretHash !== null &&
      timingSafeEqualStr(await sha256Hex(clientSecret), client.clientSecretHash);
    if (!matched) throw new AppError({ code: 'INVALID_CLIENT', message: '客户端认证失败' });
    return { client, authed: true };
  }
  return { client, authed: false };
}
