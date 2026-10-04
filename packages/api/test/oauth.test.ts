/** /api/oauth/* + /api/admin/clients 集成测试：客户端管理、授权码全流程、PKCE、重放与轮换、JWKS */
import type { OAuthClient, TokenResponse } from '@msauth/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { env } from 'cloudflare:test';
import { TestClient, auditRows, resetDb } from './helpers';

const REDIRECT_URI = 'https://client.example.com/callback';
const RESOURCE = 'https://mstor.example.com';
const AT_TTL = 120; // 客户端自定义访问令牌 TTL（TTL_LIMITS 区间内）

/** base64url 编码/解码（PKCE 与 JWT 断言用） */
function b64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(seg: string): Uint8Array {
  const pad = seg.length % 4 === 0 ? '' : '='.repeat(4 - (seg.length % 4));
  const bin = atob(seg.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** 生成 PKCE code_verifier（43 字符）与 S256 challenge */
async function pkcePair(): Promise<{ verifier: string; challenge: string }> {
  const raw = new Uint8Array(32);
  crypto.getRandomValues(raw);
  const verifier = b64url(raw);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return { verifier, challenge: b64url(new Uint8Array(digest)) };
}

/** 注册并授予 admin 角色（会话已建立） */
async function adminClient(email = 'admin@example.com'): Promise<TestClient> {
  const c = new TestClient();
  const res = await c.register(email);
  const { user } = await c.json<{ user: { id: string } }>(res);
  await env.AUTH_DB.prepare(
    "INSERT INTO user_roles (user_id, role, granted_by, granted_at) VALUES (?, 'admin', NULL, ?)",
  )
    .bind(user.id, Date.now())
    .run();
  return c;
}

/** 管理端注册客户端（默认允许全部 mstor 相关 scope + profile + offline_access） */
async function createClient(
  admin: TestClient,
  overrides: Partial<{ name: string; redirect_uris: string[]; allowed_scopes: string[]; resource: string }> = {},
): Promise<OAuthClient> {
  const res = await admin.call('POST', '/api/admin/clients', {
    body: {
      name: 'mstor-web',
      redirect_uris: [REDIRECT_URI],
      allowed_scopes: ['profile:read', 'mstor:read', 'mstor:write', 'mstor:admin', 'offline_access'],
      resource: RESOURCE,
      access_token_ttl_seconds: AT_TTL,
      ...overrides,
    },
  });
  expect(res.status).toBe(201);
  return (await admin.json<{ client: OAuthClient }>(res)).client;
}

/** 发起授权（GET /api/oauth/authorize），返回 Response */
async function authorize(
  c: TestClient,
  client: OAuthClient,
  pkce: { verifier: string; challenge: string },
  scope = 'profile:read mstor:read offline_access',
): Promise<Response> {
  const qs = new URLSearchParams({
    response_type: 'code',
    client_id: client.id,
    redirect_uri: REDIRECT_URI,
    scope,
    state: 'st-123',
    code_challenge: pkce.challenge,
    code_challenge_method: 'S256',
    resource: RESOURCE,
  });
  return c.call('GET', `/api/oauth/authorize?${qs.toString()}`);
}

/** 302 到同意页时走 approve 拿到回调地址；302 直发码时直接取回调地址 */
async function authorizeAndGetRedirect(
  c: TestClient,
  client: OAuthClient,
  pkce: { verifier: string; challenge: string },
  scope?: string,
): Promise<string> {
  const res = await authorize(c, client, pkce, scope);
  expect(res.status).toBe(302);
  const location = res.headers.get('location') ?? '';
  if (location.startsWith(`${REDIRECT_URI}?`)) return location;
  // 需要同意：取回展示信息 → 同意 → 拿回调
  const requestId = new URL(location).searchParams.get('request_id') ?? '';
  const infoRes = await c.call('GET', `/api/oauth/consent/request?request_id=${encodeURIComponent(requestId)}`);
  expect(infoRes.status).toBe(200);
  const approveRes = await c.call('POST', '/api/oauth/consent', { body: { request_id: requestId, approve: true } });
  expect(approveRes.status).toBe(200);
  const { redirect_to } = await c.json<{ redirect_to: string }>(approveRes);
  return redirect_to;
}

/** 授权码换令牌（RFC 6749 表单编码，全新客户端无 Cookie/CSRF —— 公共客户端场景） */
async function tokenExchange(c: TestClient, form: Record<string, string>): Promise<Response> {
  return c.call('POST', '/api/oauth/token', { form, csrf: false });
}

function decodeJwt(token: string): { header: Record<string, unknown>; payload: Record<string, unknown> } {
  const [h, p] = token.split('.');
  if (!h || !p) throw new Error('bad jwt');
  return {
    header: JSON.parse(new TextDecoder().decode(fromB64url(h))),
    payload: JSON.parse(new TextDecoder().decode(fromB64url(p))),
  };
}

beforeEach(resetDb);

describe('POST /api/admin/clients', () => {
  it('管理员注册客户端：201 + 前缀 c_ + TTL 生效 + 审计', async () => {
    const admin = await adminClient();
    const client = await createClient(admin);
    expect(client.id).toMatch(/^c_[A-Za-z0-9_-]{20,}$/);
    expect(client.accessTokenTtlSeconds).toBe(AT_TTL);
    expect(client.allowedScopes).toContain('mstor:read');
    await admin.flush();
    const rows = await auditRows('oauth.client.create');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.result).toBe('success');
  });

  it('非管理员：403；resource 指向 MSAuth 自身：400', async () => {
    await adminClient(); // 需要已存在 admin 才能对照，但本用例主体是普通用户
    const member = new TestClient();
    await member.register('member0@example.com');
    const forbidden = await member.call('POST', '/api/admin/clients', {
      body: { name: 'x', redirect_uris: [REDIRECT_URI], allowed_scopes: ['profile:read'], resource: RESOURCE },
    });
    expect(forbidden.status).toBe(403);

    const admin = await adminClient('admin2@example.com');
    const bad = await admin.call('POST', '/api/admin/clients', {
      body: { name: 'x', redirect_uris: [REDIRECT_URI], allowed_scopes: ['profile:read'], resource: 'http://api.test' },
    });
    expect(bad.status).toBe(400);
    expect((await admin.json<{ error: string }>(bad)).error).toBe('validation_error');
  });
});

describe('授权码全流程', () => {
  it('登录 → authorize → 同意页 → approve → code → token：JWT aud/exp/scope 正确，refresh_token 存在', async () => {
    const admin = await adminClient();
    const client = await createClient(admin);
    const member = new TestClient();
    await member.register('member@example.com');
    const memberInfo = await member.json<{ user: { id: string } }>(await member.call('GET', '/api/auth/session'));

    // 1) 无同意记录：302 到同意页
    const pkce = await pkcePair();
    const first = await authorize(member, client, pkce);
    expect(first.status).toBe(302);
    const location = first.headers.get('location') ?? '';
    expect(location.startsWith('http://api.test/oauth/consent?request_id=')).toBe(true);
    const requestId = new URL(location).searchParams.get('request_id') ?? '';

    // 2) 同意页数据
    const infoRes = await member.call('GET', `/api/oauth/consent/request?request_id=${encodeURIComponent(requestId)}`);
    expect(infoRes.status).toBe(200);
    const info = await member.json<{
      client_name: string;
      scope: string[];
      redirect_host: string;
      resource: string;
    }>(infoRes);
    expect(info.client_name).toBe('mstor-web');
    expect(info.redirect_host).toBe('client.example.com');
    expect(info.resource).toBe(RESOURCE);
    expect(info.scope).toEqual(['profile:read', 'offline_access', 'mstor:read']); // SCOPE_LIST 顺序

    // 3) 同意 → 拿 code
    const approveRes = await member.call('POST', '/api/oauth/consent', { body: { request_id: requestId, approve: true } });
    expect(approveRes.status).toBe(200);
    const { redirect_to } = await member.json<{ redirect_to: string }>(approveRes);
    expect(redirect_to.startsWith(`${REDIRECT_URI}?`)).toBe(true);
    const callback = new URL(redirect_to);
    expect(callback.searchParams.get('state')).toBe('st-123'); // state 原样回显
    const code = callback.searchParams.get('code') ?? '';
    expect(code.length).toBeGreaterThanOrEqual(40);

    // 4) 授权码换令牌（表单编码、无会话 Cookie、无 CSRF 头）
    const anonymous = new TestClient();
    const tokenRes = await tokenExchange(anonymous, {
      grant_type: 'authorization_code',
      client_id: client.id,
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: pkce.verifier,
    });
    expect(tokenRes.status).toBe(200);
    const tokens = await anonymous.json<TokenResponse>(tokenRes);
    expect(tokens.token_type).toBe('Bearer');
    expect(tokens.expires_in).toBe(AT_TTL);
    expect(tokens.refresh_token).toMatch(/^[A-Za-z0-9_-]{43}$/); // 43 字符
    expect(tokens.scope).toBe('profile:read offline_access mstor:read');

    // 5) JWT 声明
    const { header, payload } = decodeJwt(tokens.access_token);
    expect(header.alg).toBe('RS256');
    expect(typeof header.kid).toBe('string');
    expect(payload.iss).toBe('http://api.test');
    expect(payload.aud).toBe(RESOURCE);
    expect(payload.sub).toBe(memberInfo.user.id);
    expect(payload.client_id).toBe(client.id);
    expect(payload.scope).toBe(tokens.scope);
    expect((payload.exp as number) - (payload.iat as number)).toBe(AT_TTL);

    // 6) 已同意后再次 authorize：直接 302 发码（免同意）
    const pkce2 = await pkcePair();
    const second = await authorize(member, client, pkce2);
    expect(second.status).toBe(302);
    expect((second.headers.get('location') ?? '').startsWith(`${REDIRECT_URI}?code=`)).toBe(true);

    await member.flush();
    expect(await auditRows('oauth.authorize')).toHaveLength(2);
    expect(await auditRows('oauth.consent.approve')).toHaveLength(1);
    expect(await auditRows('oauth.token.issue')).toHaveLength(1);
  });

  it('未登录 authorize：401 JSON（SPA 负责登录后回跳）', async () => {
    const admin = await adminClient();
    const client = await createClient(admin);
    const pkce = await pkcePair();
    const anonymous = new TestClient();
    const res = await authorize(anonymous, client, pkce);
    expect(res.status).toBe(401);
    expect((await anonymous.json<{ error: string }>(res)).error).toBe('unauthorized');
  });

  it('拒绝授权：回调 error=access_denied + state，审计 denied', async () => {
    const admin = await adminClient();
    const client = await createClient(admin);
    const member = new TestClient();
    await member.register('member@example.com');
    const pkce = await pkcePair();
    const res = await authorize(member, client, pkce);
    const requestId = new URL(res.headers.get('location') ?? '').searchParams.get('request_id') ?? '';
    const denyRes = await member.call('POST', '/api/oauth/consent', { body: { request_id: requestId, approve: false } });
    expect(denyRes.status).toBe(200);
    const { redirect_to } = await member.json<{ redirect_to: string }>(denyRes);
    const callback = new URL(redirect_to);
    expect(callback.searchParams.get('error')).toBe('access_denied');
    expect(callback.searchParams.get('state')).toBe('st-123');
    await member.flush();
    const rows = await auditRows('oauth.consent.deny');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.result).toBe('denied');
  });

  it('错误的 code_verifier：invalid_grant', async () => {
    const admin = await adminClient();
    const client = await createClient(admin);
    const member = new TestClient();
    await member.register('member@example.com');
    const pkce = await pkcePair();
    const redirect = await authorizeAndGetRedirect(member, client, pkce);
    const code = new URL(redirect).searchParams.get('code') ?? '';
    const anonymous = new TestClient();
    const res = await tokenExchange(anonymous, {
      grant_type: 'authorization_code',
      client_id: client.id,
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: 'x'.repeat(43), // 长度合法但内容错误
    });
    expect(res.status).toBe(400);
    expect((await anonymous.json<{ error: string }>(res)).error).toBe('invalid_grant');
  });

  it('授权码二次使用：invalid_grant + 审计重放 + 关联刷新令牌被撤销', async () => {
    const admin = await adminClient();
    const client = await createClient(admin);
    const member = new TestClient();
    await member.register('member@example.com');
    const pkce = await pkcePair();
    const redirect = await authorizeAndGetRedirect(member, client, pkce);
    const code = new URL(redirect).searchParams.get('code') ?? '';
    const anonymous = new TestClient();

    const first = await tokenExchange(anonymous, {
      grant_type: 'authorization_code',
      client_id: client.id,
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: pkce.verifier,
    });
    expect(first.status).toBe(200);
    const tokens = await anonymous.json<TokenResponse>(first);

    // 同一 code 再来一次 → invalid_grant
    const replay = await tokenExchange(anonymous, {
      grant_type: 'authorization_code',
      client_id: client.id,
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: pkce.verifier,
    });
    expect(replay.status).toBe(400);
    expect((await anonymous.json<{ error: string }>(replay)).error).toBe('invalid_grant');

    // 兑换出的 RT 也被整体撤销
    const refreshRes = await tokenExchange(anonymous, {
      grant_type: 'refresh_token',
      client_id: client.id,
      refresh_token: tokens.refresh_token,
    });
    expect(refreshRes.status).toBe(400);

    await anonymous.flush();
    expect(await auditRows('oauth.code.reuse')).toHaveLength(1);
  });
});

describe('refresh_token 轮换与重用检测', () => {
  it('旧 RT 换新成功；重放旧 RT → 整链撤销，新 RT 随之失效', async () => {
    const admin = await adminClient();
    const client = await createClient(admin);
    const member = new TestClient();
    await member.register('member@example.com');
    const pkce = await pkcePair();
    const redirect = await authorizeAndGetRedirect(member, client, pkce);
    const code = new URL(redirect).searchParams.get('code') ?? '';
    const anonymous = new TestClient();

    const issue = await tokenExchange(anonymous, {
      grant_type: 'authorization_code',
      client_id: client.id,
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: pkce.verifier,
    });
    expect(issue.status).toBe(200);
    const rt1 = (await anonymous.json<TokenResponse>(issue)).refresh_token;

    // 轮换：RT1 → RT2 + 新 AT
    const rotate = await tokenExchange(anonymous, {
      grant_type: 'refresh_token',
      client_id: client.id,
      refresh_token: rt1,
    });
    expect(rotate.status).toBe(200);
    const rotated = await anonymous.json<TokenResponse>(rotate);
    expect(rotated.refresh_token).not.toBe(rt1);
    const { payload } = decodeJwt(rotated.access_token);
    expect(payload.aud).toBe(RESOURCE);
    expect(payload.scope).toBe(rotated.scope);

    // 重放 RT1 → invalid_grant
    const replay = await tokenExchange(anonymous, {
      grant_type: 'refresh_token',
      client_id: client.id,
      refresh_token: rt1,
    });
    expect(replay.status).toBe(400);
    expect((await anonymous.json<{ error: string }>(replay)).error).toBe('invalid_grant');

    // RT2 属于同一 family，已被整链撤销
    const rt2 = await tokenExchange(anonymous, {
      grant_type: 'refresh_token',
      client_id: client.id,
      refresh_token: rotated.refresh_token,
    });
    expect(rt2.status).toBe(400);

    await anonymous.flush();
    // 重放 RT1 与被牵连后再提交的 RT2 各记一条（均为 failure / refresh_reuse）
    const rows = await auditRows('oauth.token.reuse');
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.result === 'failure' && r.reason === 'refresh_reuse')).toBe(true);
    expect(await auditRows('oauth.token.refresh')).toHaveLength(1);
  });
});

describe('scope 三方交集', () => {
  it('member 请求 mstor:admin：被角色上限裁剪，令牌 scope 不含管理类', async () => {
    const admin = await adminClient();
    const client = await createClient(admin); // allowed 含 mstor:admin
    const member = new TestClient();
    await member.register('member@example.com');
    const pkce = await pkcePair();
    const redirect = await authorizeAndGetRedirect(
      member,
      client,
      pkce,
      'profile:read mstor:read mstor:admin offline_access',
    );
    const code = new URL(redirect).searchParams.get('code') ?? '';
    const anonymous = new TestClient();
    const res = await tokenExchange(anonymous, {
      grant_type: 'authorization_code',
      client_id: client.id,
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: pkce.verifier,
    });
    expect(res.status).toBe(200);
    const tokens = await anonymous.json<TokenResponse>(res);
    expect(tokens.scope).toBe('profile:read offline_access mstor:read');
    expect(tokens.scope.includes('mstor:admin')).toBe(false);
  });

  it('交集为空（member 仅请求 mstor:admin）：400 invalid_scope', async () => {
    const admin = await adminClient();
    const client = await createClient(admin);
    const member = new TestClient();
    await member.register('member@example.com');
    const pkce = await pkcePair();
    const res = await authorize(member, client, pkce, 'mstor:admin');
    expect(res.status).toBe(400);
    expect((await member.json<{ error: string }>(res)).error).toBe('invalid_scope');
  });
});

describe('GET /api/oauth/jwks 与客户端删除', () => {
  it('JWKS 返回 RS256 公钥（无私钥参数），可验签访问令牌', async () => {
    const c = new TestClient();
    const res = await c.call('GET', '/api/oauth/jwks');
    expect(res.status).toBe(200);
    const { keys } = await c.json<{ keys: Record<string, unknown>[] }>(res);
    expect(keys).toHaveLength(1);
    const jwk = keys[0]!;
    expect(jwk.alg).toBe('RS256');
    expect(jwk.kty).toBe('RSA');
    expect(jwk.use).toBe('sig');
    expect(typeof jwk.n).toBe('string');
    expect(typeof jwk.e).toBe('string');
    expect(jwk.d).toBeUndefined(); // 不得泄露私钥参数

    // 用 JWKS 公钥实际验签一枚访问令牌
    const admin = await adminClient();
    const client = await createClient(admin);
    const member = new TestClient();
    await member.register('member@example.com');
    const pkce = await pkcePair();
    const redirect = await authorizeAndGetRedirect(member, client, pkce);
    const code = new URL(redirect).searchParams.get('code') ?? '';
    const tokenRes = await tokenExchange(new TestClient(), {
      grant_type: 'authorization_code',
      client_id: client.id,
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: pkce.verifier,
    });
    const { access_token } = await new TestClient().json<TokenResponse>(tokenRes);
    const [h, p, s] = access_token.split('.');
    const verifyKey = await crypto.subtle.importKey(
      'jwk',
      jwk as unknown as JsonWebKey,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const valid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      verifyKey,
      fromB64url(s!),
      new TextEncoder().encode(`${h}.${p}`),
    );
    expect(valid).toBe(true);
  });

  it('删除客户端：级联清 codes/consents 并撤销全部 RT，authorize 随即拒绝', async () => {
    const admin = await adminClient();
    const client = await createClient(admin);
    const member = new TestClient();
    await member.register('member@example.com');
    const pkce = await pkcePair();
    const redirect = await authorizeAndGetRedirect(member, client, pkce);
    const code = new URL(redirect).searchParams.get('code') ?? '';
    const anonymous = new TestClient();
    const tokenRes = await tokenExchange(anonymous, {
      grant_type: 'authorization_code',
      client_id: client.id,
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: pkce.verifier,
    });
    expect(tokenRes.status).toBe(200);

    const delRes = await admin.call('DELETE', `/api/admin/clients/${client.id}`);
    expect(delRes.status).toBe(204);

    const counts = await env.AUTH_DB.prepare(
      `SELECT
        (SELECT COUNT(*) FROM oauth_codes WHERE client_id = ?1) AS codes,
        (SELECT COUNT(*) FROM oauth_consents WHERE client_id = ?1) AS consents,
        (SELECT COUNT(*) FROM oauth_refresh_tokens WHERE client_id = ?1 AND revoked_at IS NOT NULL) AS revoked`,
    )
      .bind(client.id)
      .first<{ codes: number; consents: number; revoked: number }>();
    expect(counts?.codes).toBe(0);
    expect(counts?.consents).toBe(0);
    expect(counts?.revoked).toBe(1);

    const pkce2 = await pkcePair();
    const after = await authorize(member, client, pkce2);
    expect(after.status).toBe(401); // 客户端已不存在
    await admin.flush();
    expect(await auditRows('oauth.client.delete')).toHaveLength(1);
  });
});
