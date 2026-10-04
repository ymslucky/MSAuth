/** GitHub OAuth 流程测试：authorize 跳转、state 一次性、用户解析/绑定 */
import { beforeEach, describe, expect, it } from 'vitest';
import { githubResolveUser } from '../src/modules/auth/github';
import { TestClient, auditRows, resetDb } from './helpers';
import { env } from 'cloudflare:test';

beforeEach(resetDb);

/** GitHub API mock：token → user → emails */
function mockGithubFetch(opts: { id?: number; login?: string; email?: string; primaryEmail?: string } = {}) {
  const { id = 4242, login = 'octocat', email = null, primaryEmail = 'gh-new@example.com' } = opts;
  return async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const u = String(url);
    const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
    if (u.includes('login/oauth/access_token')) return json({ access_token: 'gh-token', token_type: 'bearer' });
    if (u.includes('/user/emails')) {
      return json([
        { email: primaryEmail, primary: true, verified: true },
        { email: 'old@example.com', primary: false, verified: true },
      ]);
    }
    if (u.includes('/user')) return json({ id, login, name: 'Octo Cat', email });
    return new Response('nf', { status: 404 });
  };
}

/** 在 KV 里预置一个有效 state */
async function seedState(): Promise<string> {
  const state = `st-${crypto.randomUUID()}`;
  await env.KV.put(`gh_state:${state}`, '1', { expirationTtl: 600 });
  return state;
}

describe('GET /api/auth/github', () => {
  it('302 到 GitHub authorize，state 已写入 KV', async () => {
    const c = new TestClient();
    const res = await c.call('GET', '/api/auth/github');
    expect(res.status).toBe(302);
    const location = res.headers.get('location') ?? '';
    expect(location.startsWith('https://github.com/login/oauth/authorize?')).toBe(true);
    expect(location).toContain('client_id=test-client-id');
    expect(location).toContain(encodeURIComponent('http://api.test/api/auth/github/callback'));
    const state = new URL(location).searchParams.get('state') ?? '';
    expect(state.length).toBeGreaterThanOrEqual(32);
    expect(await env.KV.get(`gh_state:${state}`)).not.toBeNull();
  });
});

describe('GET /api/auth/github/callback', () => {
  it('state 无效：302 回登录页并带 error，写审计 failure', async () => {
    const c = new TestClient();
    const res = await c.call('GET', '/api/auth/github/callback?code=x&state=bogus');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('http://api.test/login?error=github_failed');
    await c.flush();
    const rows = await auditRows('auth.login.github');
    expect(rows.filter((r) => r.result === 'failure')).toHaveLength(1);
  });
});

describe('githubResolveUser（可注入 fetch）', () => {
  it('新 GitHub 用户：自动建号（无密码）+ 绑定 + state 用后即删', async () => {
    const state = await seedState();
    const user = await githubResolveUser(env, 'code-1', state, mockGithubFetch());
    expect(user.email).toBe('gh-new@example.com'); // 取 primary verified
    expect(user.hasPassword).toBe(false);
    expect(user.roles).toEqual(['member']);
    expect(user.github?.login).toBe('octocat');
    expect(await env.KV.get(`gh_state:${state}`)).toBeNull(); // 立即删除
  });

  it('网络抖动（首连超时/重置）时自动重试成功', async () => {
    const state = await seedState();
    let calls = 0;
    const flaky = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
      // 前两次：模拟 github.com 首连超时（reject）与 502
      calls++;
      if (calls === 1) throw new TypeError('fetch failed: connection timed out');
      if (calls === 2) return new Response('bad gateway', { status: 502 });
      return mockGithubFetch()(url, init);
    };
    const user = await githubResolveUser(env, 'code-flaky', state, flaky);
    expect(user.email).toBe('gh-new@example.com');
    expect(calls).toBeGreaterThanOrEqual(3);
  });

  it('state 只能用一次：复用抛 GITHUB_AUTH_FAILED', async () => {
    const state = await seedState();
    await githubResolveUser(env, 'code-1', state, mockGithubFetch());
    await expect(githubResolveUser(env, 'code-2', state, mockGithubFetch())).rejects.toMatchObject({
      code: 'GITHUB_AUTH_FAILED',
    });
  });

  it('邮箱命中已有账号：自动绑定该账号（不新建用户）', async () => {
    const c = new TestClient();
    const reg = await c.register('existing@example.com');
    const existing = await c.json<{ user: { id: string } }>(reg);
    const state = await seedState();
    const user = await githubResolveUser(env, 'code-1', state, mockGithubFetch({ primaryEmail: 'existing@example.com', id: 777 }));
    expect(user.id).toBe(existing.user.id);
    expect(user.hasPassword).toBe(true);
    // 再次 GitHub 登录（同一 github_id）→ 同一用户
    const state2 = await seedState();
    const again = await githubResolveUser(env, 'code-2', state2, mockGithubFetch({ primaryEmail: 'existing@example.com', id: 777 }));
    expect(again.id).toBe(existing.user.id);
  });
});
