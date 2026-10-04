/** /api/auth/* 集成测试：注册、登录、会话、登出、CSRF、限速、审计 */
import { beforeEach, describe, expect, it } from 'vitest';
import { TestClient, auditRows, resetDb } from './helpers';

beforeEach(resetDb);

describe('POST /api/auth/register', () => {
  it('注册成功：201 + 默认 member + 会话 Cookie + 审计 success', async () => {
    const c = new TestClient();
    const res = await c.register('Alice@Example.com');
    expect(res.status).toBe(201);
    const body = await c.json<{ user: { email: string; roles: string[]; hasPassword: boolean } }>(res);
    expect(body.user.email).toBe('alice@example.com'); // 已规范化
    expect(body.user.roles).toEqual(['member']);
    expect(body.user.hasPassword).toBe(true);
    await c.flush();
    const rows = await auditRows('auth.register');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.result).toBe('success');
    expect(rows[0]?.actor_ip).toBeTypeOf('string');
  });

  it('邮箱重复：409 + 统一错误码 + 审计 failure', async () => {
    const c = new TestClient();
    await c.register('dup@example.com');
    const res = await c.call('POST', '/api/auth/register', {
      body: { email: 'dup@example.com', password: 'password-123', displayName: '重复' },
    });
    expect(res.status).toBe(409);
    const body = await c.json<{ error: string }>(res);
    expect(body.error).toBe('email_already_registered');
    await c.flush();
    const rows = await auditRows('auth.register');
    expect(rows.filter((r) => r.result === 'failure')).toHaveLength(1);
  });

  it('非法输入：400 validation_error', async () => {
    const c = new TestClient();
    await c.bootstrapCsrf();
    const res = await c.call('POST', '/api/auth/register', {
      body: { email: 'bad', password: 'short', displayName: '' },
    });
    expect(res.status).toBe(400);
    expect((await c.json<{ error: string }>(res)).error).toBe('validation_error');
  });

  it('缺 CSRF 头：403，即使参数合法', async () => {
    const c = new TestClient();
    await c.bootstrapCsrf();
    const res = await c.call('POST', '/api/auth/register', {
      body: { email: 'x@example.com', password: 'password-123', displayName: 'X' },
      csrf: false,
    });
    expect(res.status).toBe(403);
    expect((await c.json<{ error: string }>(res)).error).toBe('csrf_invalid');
  });
});

describe('POST /api/auth/login', () => {
  it('登录成功：200 + 用户 + 会话 Cookie + 审计 success', async () => {
    const c = new TestClient();
    await c.register('login@example.com');
    const c2 = new TestClient();
    const res = await c2.login('login@example.com');
    expect(res.status).toBe(200);
    const body = await c2.json<{ user: { email: string } }>(res);
    expect(body.user.email).toBe('login@example.com');
    await c2.flush();
    const rows = await auditRows('auth.login');
    expect(rows.filter((r) => r.result === 'success')).toHaveLength(1);
  });

  it('密码错误：401 + 审计 failure', async () => {
    const c = new TestClient();
    await c.register('login@example.com');
    const res = await c.login('login@example.com', 'wrong-password');
    expect(res.status).toBe(401);
    await c.flush();
    const rows = await auditRows('auth.login');
    expect(rows.filter((r) => r.result === 'failure')).toHaveLength(1);
  });

  it('邮箱不存在：401 且响应与密码错误完全一致（防枚举）', async () => {
    const c = new TestClient();
    await c.register('login@example.com');
    const wrongPw = await c.login('login@example.com', 'wrong-password');
    const unknown = await c.login('ghost@example.com', 'wrong-password');
    expect(unknown.status).toBe(wrongPw.status);
    expect(await unknown.text()).toBe(await wrongPw.text());
  });

  it('同一 IP 连续 6 次失败登录：第 6 次 429', async () => {
    const c = new TestClient();
    await c.register('rl@example.com');
    const fixed = '198.51.100.7';
    const results: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await c.call('POST', '/api/auth/login', {
        body: { email: 'rl@example.com', password: 'nope-nope-nope' },
        ip: fixed,
      });
      results.push(res.status);
    }
    expect(results.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    expect(results[5]).toBe(429);
  });
});

describe('GET /api/auth/session', () => {
  it('带会话：返回当前用户与会话 id', async () => {
    const c = new TestClient();
    await c.register('sess@example.com');
    const res = await c.call('GET', '/api/auth/session');
    expect(res.status).toBe(200);
    const body = await c.json<{ user: { email: string }; sessionId: string }>(res);
    expect(body.user.email).toBe('sess@example.com');
    expect(body.sessionId).toMatch(/^[0-9a-f]{64}$/);
  });

  it('无会话：401', async () => {
    const c = new TestClient();
    const res = await c.call('GET', '/api/auth/session');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('登出后清除 Cookie，会话立即失效，写审计', async () => {
    const c = new TestClient();
    await c.register('out@example.com');
    const res = await c.call('POST', '/api/auth/logout');
    expect(res.status).toBe(200);
    const after = await c.call('GET', '/api/auth/session');
    expect(after.status).toBe(401);
    await c.flush();
    const rows = await auditRows('auth.logout');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.result).toBe('success');
  });
});

describe('GET /api/auth/csrf', () => {
  it('返回 token 并设置 Cookie', async () => {
    const c = new TestClient();
    const res = await c.call('GET', '/api/auth/csrf');
    expect(res.status).toBe(200);
    const body = await c.json<{ csrfToken: string }>(res);
    expect(body.csrfToken).toMatch(/^[A-Za-z0-9_-]{40,}$/);
  });
});

describe('GET /healthz', () => {
  it('健康检查可用且无需会话', async () => {
    const c = new TestClient();
    const res = await c.call('GET', '/healthz');
    expect(res.status).toBe(200);
    expect(await c.json<{ ok: boolean }>(res)).toEqual({ ok: true });
  });
});
