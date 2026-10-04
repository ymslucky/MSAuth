/**
 * 会话生命周期：创建（ULID 明文进 Cookie，SHA-256 哈希入库）、撤销、Cookie 操作。
 * Cookie 属性：HttpOnly + Secure + SameSite=Lax + __Host- 前缀。
 */
import { COOKIES, SESSION_ABSOLUTE_TTL } from '@msauth/shared';
import { deleteCookie, setCookie } from 'hono/cookie';
import type { Context } from 'hono';
import { SessionsRepository, dbOf } from '../../db/repositories';
import { sha256Hex } from '../../lib/crypto';
import { ulid } from '../../lib/ulid';
import type { AppEnv } from '../../env';

/** 创建会话并写入 Cookie，返回 id_hash */
export async function createSession(c: Context<AppEnv>, userId: string): Promise<string> {
  const rawId = ulid();
  const idHash = await sha256Hex(rawId);
  const now = Date.now();
  await new SessionsRepository(dbOf(c.env)).create({
    idHash,
    userId,
    createdAt: now,
    lastSeenAt: now,
    expiresAt: now + SESSION_ABSOLUTE_TTL * 1000,
    ip: c.req.header('CF-Connecting-IP') ?? null,
    userAgent: c.req.header('user-agent') ?? null,
  });
  setCookie(c, COOKIES.session, rawId, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: SESSION_ABSOLUTE_TTL,
  });
  return idHash;
}

/** 撤销当前会话（登出）：删库 + 清 Cookie；幂等 */
export async function revokeCurrentSession(c: Context<AppEnv>): Promise<void> {
  const idHash = c.get('sessionIdHash');
  if (idHash) {
    await new SessionsRepository(dbOf(c.env)).remove(idHash);
  }
  deleteCookie(c, COOKIES.session, { path: '/', secure: true, sameSite: 'Lax', httpOnly: true });
}
