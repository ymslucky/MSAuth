/** /api/account/* 集成测试：会话列表/撤销/撤销其他、改密码联动撤销 */
import { COOKIES } from '@msauth/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { sha256Hex } from '../src/lib/crypto';
import { ulid } from '../src/lib/ulid';
import { SessionsRepository, UsersRepository } from '../src/db/repositories';
import { dbOf } from '../src/db/client';
import { TestClient, auditRows, resetDb } from './helpers';
import { env } from 'cloudflare:test';

beforeEach(resetDb);

describe('鉴权', () => {
  it('未登录访问 /api/account/sessions：401', async () => {
    const c = new TestClient();
    expect((await c.call('GET', '/api/account/sessions')).status).toBe(401);
  });

  it('未登录改密码：401', async () => {
    const c = new TestClient();
    await c.bootstrapCsrf();
    expect(
      (await c.call('POST', '/api/account/password', { body: { currentPassword: 'a', newPassword: '0123456789' } })).status,
    ).toBe(401);
  });
});

describe('GET /api/account/sessions', () => {
  it('多设备登录后列出全部会话并标记当前', async () => {
    const c1 = new TestClient();
    await c1.register('multi@example.com');
    const c2 = new TestClient();
    await c2.login('multi@example.com');
    const res = await c1.call('GET', '/api/account/sessions');
    expect(res.status).toBe(200);
    const body = await c1.json<{ sessions: { id: string; current: boolean; userAgent: string | null }[] }>(res);
    expect(body.sessions).toHaveLength(2);
    const current = body.sessions.filter((s) => s.current);
    expect(current).toHaveLength(1);
    expect(current[0]?.userAgent).toBe('vitest-agent');
    const me = await c1.json<{ sessionId: string }>(await c1.call('GET', '/api/auth/session'));
    expect(current[0]?.id).toBe(me.sessionId);
  });
});

describe('DELETE /api/account/sessions/:id', () => {
  it('撤销其他设备会话：对方立即 401，写审计', async () => {
    const c1 = new TestClient();
    await c1.register('kill@example.com');
    const c2 = new TestClient();
    await c2.login('kill@example.com');
    const list = await c1.json<{ sessions: { id: string; current: boolean }[] }>(
      await c1.call('GET', '/api/account/sessions'),
    );
    const other = list.sessions.find((s) => !s.current);
    expect(other).toBeDefined();
    const res = await c1.call('DELETE', `/api/account/sessions/${other!.id}`);
    expect(res.status).toBe(200);
    expect((await c2.call('GET', '/api/auth/session')).status).toBe(401);
    expect((await c1.call('GET', '/api/auth/session')).status).toBe(200);
    await c1.flush();
    expect(await auditRows('auth.session.revoke')).toHaveLength(1);
  });

  it('撤销当前会话等同登出', async () => {
    const c = new TestClient();
    await c.register('self@example.com');
    const me = await c.json<{ sessionId: string }>(await c.call('GET', '/api/auth/session'));
    const res = await c.call('DELETE', `/api/account/sessions/${me.sessionId}`);
    expect(res.status).toBe(200);
    expect((await c.call('GET', '/api/auth/session')).status).toBe(401);
  });

  it('不存在的会话 id：404', async () => {
    const c = new TestClient();
    await c.register('nf@example.com');
    const res = await c.call('DELETE', `/api/account/sessions/${'0'.repeat(64)}`);
    expect(res.status).toBe(404);
  });
});

describe('POST /api/account/sessions/revoke-others', () => {
  it('撤销其他所有会话，保留当前', async () => {
    const c1 = new TestClient();
    await c1.register('others@example.com');
    const c2 = new TestClient();
    await c2.login('others@example.com');
    const c3 = new TestClient();
    await c3.login('others@example.com');
    const res = await c1.call('POST', '/api/account/sessions/revoke-others');
    expect(res.status).toBe(200);
    expect(await c1.json<{ revoked: number }>(res)).toEqual({ revoked: 2 });
    expect((await c1.call('GET', '/api/auth/session')).status).toBe(200);
    expect((await c2.call('GET', '/api/auth/session')).status).toBe(401);
    expect((await c3.call('GET', '/api/auth/session')).status).toBe(401);
    await c1.flush();
    expect(await auditRows('auth.session.revoke_others')).toHaveLength(1);
  });
});

describe('POST /api/account/password', () => {
  it('当前密码错误：401 + 审计 failure', async () => {
    const c = new TestClient();
    await c.register('pw@example.com');
    const res = await c.call('POST', '/api/account/password', {
      body: { currentPassword: 'wrong-wrong', newPassword: 'new-password-9' },
    });
    expect(res.status).toBe(401);
    await c.flush();
    const rows = await auditRows('auth.password.change');
    expect(rows.filter((r) => r.result === 'failure')).toHaveLength(1);
  });

  it('改密码成功：其他会话撤销、当前保留、新旧密码行为正确、审计 success', async () => {
    const c1 = new TestClient();
    await c1.register('pw@example.com');
    const c2 = new TestClient();
    await c2.login('pw@example.com');
    const res = await c1.call('POST', '/api/account/password', {
      body: { currentPassword: 'password-123', newPassword: 'brand-new-456' },
    });
    expect(res.status).toBe(200);
    // 其他设备登出，当前保留
    expect((await c2.call('GET', '/api/auth/session')).status).toBe(401);
    expect((await c1.call('GET', '/api/auth/session')).status).toBe(200);
    // 旧密码失效，新密码可登录
    expect((await new TestClient().login('pw@example.com', 'password-123')).status).toBe(401);
    expect((await new TestClient().login('pw@example.com', 'brand-new-456')).status).toBe(200);
    await c1.flush();
    const rows = await auditRows('auth.password.change');
    expect(rows.filter((r) => r.result === 'success')).toHaveLength(1);
  });

  it('GitHub-only 用户可用空当前密码首次设置密码', async () => {
    // 直接造一个无密码用户 + 会话（绕过登录）
    const users = new UsersRepository(dbOf(env));
    const userId = ulid();
    await users.create({ id: userId, email: 'gh-only@example.com', displayName: 'GH', passwordHash: null });
    const rawSessionId = ulid();
    const sessions = new SessionsRepository(dbOf(env));
    const now = Date.now();
    await sessions.create({
      idHash: await sha256Hex(rawSessionId),
      userId,
      createdAt: now,
      lastSeenAt: now,
      expiresAt: now + 60_000,
      ip: null,
      userAgent: 'manual',
    });
    const c = new TestClient();
    await c.bootstrapCsrf();
    c.setRawCookie(COOKIES.session, rawSessionId);
    expect((await c.call('GET', '/api/auth/session')).status).toBe(200);
    const res = await c.call('POST', '/api/account/password', {
      body: { currentPassword: '', newPassword: 'first-password-7' },
    });
    expect(res.status).toBe(200);
    expect((await new TestClient().login('gh-only@example.com', 'first-password-7')).status).toBe(200);
  });
});
