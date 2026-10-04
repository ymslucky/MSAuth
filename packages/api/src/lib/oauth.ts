/**
 * OAuth 2.1 基础设施：RS256 签名密钥（KV 持久化 + 模块级缓存）、访问令牌签发。
 *
 * 约定：
 * - 访问令牌为 RS256 JWT（资源服务器经 /api/oauth/jwks 取公钥自验签），
 *   不复用 lib/jwt.ts 的 ES256 工具（那套 alg 固定，语义不同）。
 * - 私钥以完整 JWK 存 KV（key: 'oauth:signing-key'），仅在首次访问时生成；
 *   Workers 实例内做模块级缓存，避免每个请求都读 KV。
 * - 随机串直接复用 crypto.ts 的 randomToken（base64url，授权码 / RT / code_verifier 同格式）。
 */
import { SignJWT } from 'jose';
import type { Env } from '../env';
import { randomToken, toB64Url } from './crypto';
import { ulid } from './ulid';

const SIGNING_KEY_KV = 'oauth:signing-key';

/** KV 中存储的完整私钥参数（敏感，仅服务端可见，绝不进入 JWKS 响应） */
interface StoredSigningKey {
  kid: string;
  jwk: JsonWebKey;
}

/** 对外暴露的签名材料：publicJwk 只含公钥参数（n/e）与元数据 */
export interface SigningKey {
  publicJwk: { kty: 'RSA'; kid: string; alg: 'RS256'; use: 'sig'; n: string; e: string };
  privateKey: CryptoKey;
  kid: string;
}

/** 模块级缓存：同一 isolate 内只解析/生成一次 */
let cachedKey: SigningKey | null = null;

/** 随机 12 位 hex（kid） */
function randomKid(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function publicOf(jwk: JsonWebKey, kid: string): SigningKey['publicJwk'] {
  return { kty: 'RSA', kid, alg: 'RS256', use: 'sig', n: jwk.n!, e: jwk.e! };
}

/** 获取（或首次生成）RS256 签名密钥对 */
export async function getSigningKey(env: Env): Promise<SigningKey> {
  if (cachedKey) return cachedKey;

  const stored = await env.KV.get<StoredSigningKey>(SIGNING_KEY_KV, 'json');
  if (stored?.jwk.n && stored.jwk.d) {
    const privateKey = await crypto.subtle.importKey(
      'jwk',
      stored.jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      true,
      ['sign'],
    );
    cachedKey = { privateKey, kid: stored.kid, publicJwk: publicOf(stored.jwk, stored.kid) };
    return cachedKey;
  }

  // 首次生成：RSASSA-PKCS1-v1_5 2048 位 SHA-256（RS256）
  const pair = (await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair;
  const jwk = (await crypto.subtle.exportKey('jwk', pair.privateKey)) as JsonWebKey;
  const kid = randomKid();
  await env.KV.put(SIGNING_KEY_KV, JSON.stringify({ kid, jwk } satisfies StoredSigningKey));
  cachedKey = { privateKey: pair.privateKey, kid, publicJwk: publicOf(jwk, kid) };
  return cachedKey;
}

/** 访问令牌声明（iss/jti 由签发函数补充） */
export interface AccessTokenInput {
  /** JWT sub：用户令牌为用户 id；client_credentials 为 client_id（机器身份，无用户） */
  subject: string;
  /** JWT aud：下游资源服务器标识 */
  resource: string;
  clientId: string;
  /** 空格连接的授权 scope */
  scope: string;
  /** 按客户端配置的访问令牌寿命（秒） */
  ttlSeconds: number;
}

/** 签发 RS256 访问令牌：iss=APP_BASE_URL、sub=subject、aud=resource、client_id、scope、jti=ULID */
export async function signAccessToken(env: Env, input: AccessTokenInput): Promise<string> {
  const { privateKey, kid } = await getSigningKey(env);
  const iat = Math.floor(Date.now() / 1000);
  return new SignJWT({ client_id: input.clientId, scope: input.scope })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT', kid })
    .setIssuer(env.APP_BASE_URL)
    .setSubject(input.subject)
    .setAudience(input.resource)
    .setIssuedAt(iat)
    .setExpirationTime(iat + input.ttlSeconds)
    .setJti(ulid())
    .sign(privateKey);
}

/** PKCE S256：base64url(SHA-256(code_verifier))，与授权请求的 code_challenge 比较 */
export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return toB64Url(new Uint8Array(digest));
}
