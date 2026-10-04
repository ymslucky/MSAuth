/**
 * JWT 签发/校验（jose 封装）。
 * Phase 1 仅作为基础工具就位（含测试）；OAuth 2.1 访问令牌从 Phase 2a 起复用。
 * 约定：aud 必须绑定具体资源服务器标识（mstor / pve），绝不等于 MSAuth 自身 baseURL。
 */
import { SignJWT, jwtVerify } from 'jose';

export interface JwtSignOptions {
  issuer?: string;
  audience?: string;
  /** 过期时长（秒），默认 900（15 分钟） */
  expiresIn?: number;
}

export interface JwtVerifyOptions {
  issuer?: string;
  audience?: string;
}

export async function signJwt(
  claims: Record<string, unknown>,
  key: CryptoKey,
  options: JwtSignOptions = {},
): Promise<string> {
  const expiresIn = options.expiresIn ?? 900;
  const builder = new SignJWT(claims)
    .setProtectedHeader({ alg: 'ES256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime(`${expiresIn}s`);
  if (options.issuer) builder.setIssuer(options.issuer);
  if (options.audience) builder.setAudience(options.audience);
  return builder.sign(key);
}

/** 校验失败（签名/过期/aud 不匹配等）一律返回 null，由调用方决定错误语义 */
export async function verifyJwt<T = Record<string, unknown>>(
  token: string,
  key: CryptoKey,
  options: JwtVerifyOptions = {},
): Promise<T | null> {
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ['ES256'],
      ...(options.issuer ? { issuer: options.issuer } : {}),
      ...(options.audience ? { audience: options.audience } : {}),
    });
    return payload as T;
  } catch {
    return null;
  }
}
