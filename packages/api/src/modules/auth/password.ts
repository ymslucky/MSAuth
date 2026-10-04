/**
 * 密码哈希：Web Crypto PBKDF2（SHA-256 × 100000，盐 16B，派生 32B）。
 * 存储格式（自描述，便于未来提升参数）：
 *   pbkdf2$sha256$<iterations>$<salt-b64url>$<hash-b64url>
 */
import { PBKDF2_PARAMS } from '@msauth/shared';
import { fromB64Url, timingSafeEqualStr, toB64Url } from '../../lib/crypto';

const TE = new TextEncoder();

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', TE.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: PBKDF2_PARAMS.hash, salt: salt as BufferSource, iterations },
    key,
    PBKDF2_PARAMS.keyBytes * 8,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(PBKDF2_PARAMS.saltBytes);
  crypto.getRandomValues(salt);
  const hash = await derive(password, salt, PBKDF2_PARAMS.iterations);
  // 标签统一为 sha256（无连字符），格式：pbkdf2$sha256$<iter>$<salt>$<hash>
  const hashLabel = PBKDF2_PARAMS.hash.toLowerCase().replace('-', '');
  return ['pbkdf2', hashLabel, String(PBKDF2_PARAMS.iterations), toB64Url(salt), toB64Url(hash)].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 5 || parts[0] !== 'pbkdf2') return false;
  const [, , iterStr, saltB64, hashB64] = parts as [string, string, string, string, string];
  const iterations = Number(iterStr);
  // 防御性上限：拒绝异常参数，避免被恶意存储串拖垮 CPU
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > 1_000_000) return false;
  let computed: Uint8Array;
  try {
    computed = await derive(password, fromB64Url(saltB64), iterations);
  } catch {
    return false;
  }
  return timingSafeEqualStr(toB64Url(computed), hashB64);
}

let dummyHash: string | null = null;

/**
 * 登录失败路径的时序对齐：无论用户是否存在都执行一次完整哈希 + 验证，
 * 使「邮箱不存在」与「密码错误」耗时一致，防时序侧信道枚举。
 */
export async function burnDummyPassword(): Promise<void> {
  dummyHash ??= await hashPassword(crypto.randomUUID());
  await verifyPassword(crypto.randomUUID(), dummyHash);
}
