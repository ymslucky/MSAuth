/** Phase 2b 集成测试：机密客户端（confidential）注册/secret 轮换 + client_credentials 授权模式
 * + 客户端归属权（owner）模型：谁创建谁管理，他人一律 404。 */
import type { ClientSecretCreated, OAuthClient, TokenResponse } from '@msauth/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { env } from 'cloudflare:test';
import { TestClient, auditRows, resetDb } from './helpers';

const REDIRECT_URI = 'https://client.example.com/callback';
const RESOURCE = 'https://mstor.example.com';
const AT_TTL = 120; // 客户端自定义访问令牌 TTL（TTL_LIMITS 区间内）
const ALLOWED = ['profile:read', 'mstor:read', 'mstor:write', 'mstor:admin', 'offline_access'];
/** member 角色矩阵内的 scope 子集（不含 :admin 管理类） */
const MEMBER_ALLOWED = ALLOWED.filter((s) => !s.endsWith(':admin'));

function fromB64url(seg: string): Uint8Array {
  const pad = seg.length % 4 === 0 ? '' : '='.repeat(4 - (seg.length % 4));
  const bin = atob(seg.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** 生成 PKCE code_verifier（43 字符）与 S256 challenge */
async function pkcePair(): Promise<{ verifier: string; challenge: string }> {
  function b64url(bytes: Uint8Array): string {
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
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

interface CreatedClient {
  client: OAuthClient;
  /** confidential 专有；public 为 null */
  secret: string | null;
}

/** 归属者注册客户端（默认全量 scope 需 admin 角色；member 需传 allowed_scopes=MEMBER_ALLOWED） */
async function createClient(
  owner: TestClient,
  overrides: Partial<{ name: string; clientType: 'public' | 'confidential'; allowed_scopes: string[] }> = {},
): Promise<CreatedClient> {
  const res = await owner.call('POST', '/api/account/clients', {
    body: {
      name: overrides.name ?? 'mstor-cli',
      clientType: overrides.clientType,
      redirect_uris: [REDIRECT_URI],
      allowed_scopes: overrides.allowed_scopes ?? ALLOWED,
      resource: RESOURCE,
      access_token_ttl_seconds: AT_TTL,
    },
  });
  expect(res.status).toBe(201);
  const body = await owner.json<{ client: OAuthClient; clientSecret?: string }>(res);
  return { client: body.client, secret: body.clientSecret ?? null };
}

/** 令牌端点请求（表单编码，无 Cookie/CSRF） */
async function tokenRequest(
  c: TestClient,
  form: Record<string, string>,
  headers: Record<string, string> = {},
): Promise<Response> {
  return c.call('POST', '/api/oauth/token', { form, csrf: false, headers });
}

/** client_credentials 兑换（client_secret_post） */
function cc(c: TestClient, client: OAuthClient, secret: string, scope?: string): Promise<Response> {
  const form: Record<string, string> = {
    grant_type: 'client_credentials',
    client_id: client.id,
    client_secret: secret,
  };
  if (scope !== undefined) form.scope = scope;
  return tokenRequest(c, form);
}

function decodeJwt(token: string): Record<string, unknown> {
  const [, p] = token.split('.');
  if (!p) throw new Error('bad jwt');
  return JSON.parse(new TextDecoder().decode(fromB64url(p)));
}

/**
 * RFC 6749 §2.3.1 Basic 头：两值先 percent-encode 再拼 'id:secret' 后 base64。
 * '_' → %5F 显式覆盖服务端的 percent-decode 路径（其余 base64url 字符编码后不变）。
 */
function basicHeader(clientId: string, secret: string): string {
  return `Basic ${btoa(`${clientId.replaceAll('_', '%5F')}:${secret.replaceAll('_', '%5F')}`)}`;
}

beforeEach(resetDb);

describe('机密客户端注册', () => {
  it('confidential：返回 cs_ 前缀 secret（仅一次），DB 只存 SHA-256 hex，列表/详情不回显', async () => {
    const admin = await adminClient();
    const { client, secret } = await createClient(admin, { clientType: 'confidential' });

    expect(client.clientType).toBe('confidential');
    expect(secret).toMatch(/^cs_[A-Za-z0-9_-]{43}$/); // 'cs_' + base64url(32B)

    // 库中只存哈希，且不是 secret 本体
    const row = await env.AUTH_DB.prepare(
      'SELECT client_type, client_secret_hash FROM oauth_clients WHERE id = ?',
    )
      .bind(client.id)
      .first<{ client_type: string; client_secret_hash: string | null }>();
    expect(row?.client_type).toBe('confidential');
    expect(row?.client_secret_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row?.client_secret_hash).not.toBe(secret);

    // 列表与详情响应不含 secret / 哈希字段
    const listRes = await admin.call('GET', '/api/account/clients');
    const listBody = await admin.json<{ clients: OAuthClient[] }>(listRes);
    expect(JSON.stringify(listBody)).not.toContain(secret!);
    expect(listBody.clients[0]?.clientType).toBe('confidential');
    const detail = await admin.call('GET', `/api/account/clients/${client.id}`);
    expect(JSON.stringify(await detail.json())).not.toContain('client_secret');
  });

  it('public（默认）：响应不含 client_secret，clientType=public；审计 metadata 带 clientType', async () => {
    const admin = await adminClient();
    const { client, secret } = await createClient(admin); // 未传 clientType
    expect(secret).toBeNull();
    expect(client.clientType).toBe('public');

    await admin.flush();
    const rows = await auditRows('oauth.client.create');
    expect(rows).toHaveLength(1);
    expect(JSON.parse(rows[0]!.metadata as string).clientType).toBe('public');
  });
});

describe('client_credentials 授权模式', () => {
  it('client_secret_post 不带 scope：签发 AT（sub=client_id、aud=resource、无 RT、scope=全部 allowed）', async () => {
    const admin = await adminClient();
    const { client, secret } = await createClient(admin, { clientType: 'confidential' });

    const anon = new TestClient();
    const res = await cc(anon, client, secret!);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store'); // RFC 6749 §5.1
    expect(res.headers.get('pragma')).toBe('no-cache');

    const body = await anon.json<TokenResponse>(res);
    expect(body.token_type).toBe('Bearer');
    expect(body.expires_in).toBe(AT_TTL);
    expect('refresh_token' in body).toBe(false); // client_credentials 不签发 RT
    expect(body.scope).toBe(ALLOWED.join(' ')); // 未带 scope → 全部 allowed_scopes

    const payload = decodeJwt(body.access_token);
    expect(payload.iss).toBe('http://api.test');
    expect(payload.sub).toBe(client.id); // 机器身份：sub 即 client_id
    expect(payload.aud).toBe(RESOURCE);
    expect(payload.client_id).toBe(client.id);
    expect(payload.scope).toBe(body.scope);
    expect((payload.exp as number) - (payload.iat as number)).toBe(AT_TTL);

    // 审计：oauth.token.issue + grant_type=client_credentials + actor 为客户端
    await anon.flush();
    const rows = await auditRows('oauth.token.issue');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.actor_type).toBe('client');
    expect(rows[0]!.actor_id).toBe(client.id);
    expect(JSON.parse(rows[0]!.metadata as string).grant_type).toBe('client_credentials');
  });

  it('带 scope 子集 → 裁剪到交集；全部非法 scope → invalid_scope', async () => {
    const admin = await adminClient();
    const { client, secret } = await createClient(admin, { clientType: 'confidential' });
    const anon = new TestClient();

    // 子集（乱序请求，输出按客户端注册顺序稳定）
    const sub = await cc(anon, client, secret!, 'mstor:write profile:read');
    expect(sub.status).toBe(200);
    expect((await anon.json<TokenResponse>(sub)).scope).toBe('profile:read mstor:write');

    // 夹带未注册 scope：只保留交集部分
    const mixed = await cc(anon, client, secret!, 'mstor:read pve:admin');
    expect(mixed.status).toBe(200);
    expect((await anon.json<TokenResponse>(mixed)).scope).toBe('mstor:read');

    // 完全非法 → invalid_scope
    const bad = await cc(anon, client, secret!, 'pve:read pve:write');
    expect(bad.status).toBe(400);
    expect((await anon.json<{ error: string }>(bad)).error).toBe('invalid_scope');
  });

  it('不带 secret / 错误 secret / 不存在的 client：invalid_client 且 HTTP 401（响应带 no-store）', async () => {
    const admin = await adminClient();
    const { client, secret } = await createClient(admin, { clientType: 'confidential' });
    const anon = new TestClient();

    const noSecret = await tokenRequest(anon, {
      grant_type: 'client_credentials',
      client_id: client.id,
    });
    expect(noSecret.status).toBe(401);
    expect(noSecret.headers.get('cache-control')).toBe('no-store');
    expect((await anon.json<{ error: string }>(noSecret)).error).toBe('invalid_client');

    const wrong = await cc(anon, client, 'cs_' + 'x'.repeat(43));
    expect(wrong.status).toBe(401);
    expect((await anon.json<{ error: string }>(wrong)).error).toBe('invalid_client');

    const ghost = await tokenRequest(anon, {
      grant_type: 'client_credentials',
      client_id: 'c_notexist',
      client_secret: 'cs_whatever',
    });
    expect(ghost.status).toBe(401);
    expect((await anon.json<{ error: string }>(ghost)).error).toBe('invalid_client');
  });

  it('client_secret_basic（Authorization: Basic 头，urlencoded 值）：client_credentials 成功', async () => {
    const admin = await adminClient();
    const { client, secret } = await createClient(admin, { clientType: 'confidential' });
    const anon = new TestClient();

    const res = await tokenRequest(
      anon,
      { grant_type: 'client_credentials' },
      { authorization: basicHeader(client.id, secret!) },
    );
    expect(res.status).toBe(200);
    const body = await anon.json<TokenResponse>(res);
    expect(decodeJwt(body.access_token).sub).toBe(client.id);

    // Basic 中带错误 secret → 401
    const bad = await tokenRequest(
      anon,
      { grant_type: 'client_credentials' },
      { authorization: basicHeader(client.id, 'cs_wrong') },
    );
    expect(bad.status).toBe(401);
    expect((await anon.json<{ error: string }>(bad)).error).toBe('invalid_client');
  });

  it('public 客户端调 client_credentials → invalid_client（HTTP 401）', async () => {
    const admin = await adminClient();
    const { client } = await createClient(admin); // public
    const anon = new TestClient();

    const res = await tokenRequest(anon, {
      grant_type: 'client_credentials',
      client_id: client.id,
    });
    expect(res.status).toBe(401);
    expect((await anon.json<{ error: string }>(res)).error).toBe('invalid_client');
  });
});

describe('secret 轮换', () => {
  it('rotate-secret：旧 secret 立即失效，新 secret 可用，审计 rotate_secret；public 调用 → 400', async () => {
    const admin = await adminClient();
    const { client, secret } = await createClient(admin, { clientType: 'confidential' });
    const anon = new TestClient();

    const rotateRes = await admin.call('POST', `/api/account/clients/${client.id}/rotate-secret`);
    expect(rotateRes.status).toBe(200);
    const rotated = await admin.json<ClientSecretCreated>(rotateRes);
    const newSecret = rotated.clientSecret;
    expect(rotated.id).toBe(client.id);
    expect(newSecret).toMatch(/^cs_[A-Za-z0-9_-]{43}$/);
    expect(newSecret).not.toBe(secret);

    // 旧 secret → 401；新 secret → 200
    const old = await cc(anon, client, secret!);
    expect(old.status).toBe(401);
    expect((await anon.json<{ error: string }>(old)).error).toBe('invalid_client');
    const fresh = await cc(anon, client, newSecret);
    expect(fresh.status).toBe(200);

    await admin.flush();
    expect(await auditRows('oauth.client.rotate_secret')).toHaveLength(1);

    // public 客户端无 secret，轮换 → 400
    const { client: pub } = await createClient(admin, { name: 'pub-app' });
    const badRotate = await admin.call('POST', `/api/account/clients/${pub.id}/rotate-secret`);
    expect(badRotate.status).toBe(400);
    expect((await admin.json<{ error: string }>(badRotate)).error).toBe('validation_error');
  });
});

describe('客户端更新（PATCH /api/account/clients/:id）', () => {
  it('更新 name/redirect_uris/TTL 成功：响应含新值，未传字段保持不变，审计 oauth.client.update', async () => {
    const admin = await adminClient();
    const { client } = await createClient(admin, { clientType: 'confidential' });

    const res = await admin.call('PATCH', `/api/account/clients/${client.id}`, {
      body: {
        name: 'mstor-cli-v2',
        redirect_uris: ['https://client.example.com/cb2', 'https://client.example.com/cb3'],
        access_token_ttl_seconds: 3600,
        refresh_token_ttl_seconds: 30 * 24 * 60 * 60,
      },
    });
    expect(res.status).toBe(200);
    const { client: updated } = await admin.json<{ client: OAuthClient }>(res);
    expect(updated.name).toBe('mstor-cli-v2');
    expect(updated.redirectUris).toEqual(['https://client.example.com/cb2', 'https://client.example.com/cb3']);
    expect(updated.accessTokenTtlSeconds).toBe(3600);
    expect(updated.refreshTokenTtlSeconds).toBe(30 * 24 * 60 * 60);
    // 未传字段保持原值
    expect(updated.allowedScopes).toEqual(ALLOWED);
    expect(updated.resource).toBe(RESOURCE);
    expect(updated.clientType).toBe('confidential');
    expect(updated.updatedAt).toBeGreaterThanOrEqual(client.updatedAt);

    await admin.flush();
    expect(await auditRows('oauth.client.update')).toHaveLength(1);
  });

  it('空 body → 400；夹带 clientType → 400（类型不可改，需删除重建）', async () => {
    const admin = await adminClient();
    const { client } = await createClient(admin);

    const empty = await admin.call('PATCH', `/api/account/clients/${client.id}`, { body: {} });
    expect(empty.status).toBe(400);
    expect((await admin.json<{ error: string }>(empty)).error).toBe('validation_error');

    const withType = await admin.call('PATCH', `/api/account/clients/${client.id}`, {
      body: { clientType: 'confidential' },
    });
    expect(withType.status).toBe(400);
  });

  it('非法 scope / resource 指向 MSAuth 自身 → 400', async () => {
    const admin = await adminClient();
    const { client } = await createClient(admin);

    const badScope = await admin.call('PATCH', `/api/account/clients/${client.id}`, {
      body: { allowed_scopes: ['not:a:scope'] },
    });
    expect(badScope.status).toBe(400);
    expect((await admin.json<{ error: string }>(badScope)).error).toBe('validation_error');

    const selfResource = await admin.call('PATCH', `/api/account/clients/${client.id}`, {
      body: { resource: 'http://api.test' }, // 测试环境 APP_BASE_URL
    });
    expect(selfResource.status).toBe(400);
  });

  it('不存在的客户端 → 404', async () => {
    const admin = await adminClient();
    const res = await admin.call('PATCH', '/api/account/clients/c_notexist', { body: { name: 'ghost' } });
    expect(res.status).toBe(404);
    expect((await admin.json<{ error: string }>(res)).error).toBe('not_found');
  });
});

describe('归属权模型（/api/account/clients，谁创建谁管理）', () => {
  it('member 无需 admin 即可完整管理自己的客户端：创建/更新/轮换/删除', async () => {
    const member = new TestClient();
    const reg = await member.register('member@example.com');
    const { user } = await member.json<{ user: { id: string } }>(reg);

    const { client } = await createClient(member, {
      clientType: 'confidential',
      allowed_scopes: MEMBER_ALLOWED,
    });
    expect(client.createdBy).toBe(user.id);

    const patch = await member.call('PATCH', `/api/account/clients/${client.id}`, {
      body: { name: 'member-cli-v2' },
    });
    expect(patch.status).toBe(200);
    expect((await member.json<{ client: OAuthClient }>(patch)).client.name).toBe('member-cli-v2');

    const rotate = await member.call('POST', `/api/account/clients/${client.id}/rotate-secret`);
    expect(rotate.status).toBe(200);

    const del = await member.call('DELETE', `/api/account/clients/${client.id}`);
    expect(del.status).toBe(204);
  });

  it('用户 B 列表看不到用户 A 的客户端；B 对 A 的 GET/PATCH/DELETE/rotate → 404（防枚举）', async () => {
    // alice 用 admin 仅为可注册全量 scope，归属权语义与角色无关
    const alice = await adminClient('alice@example.com');
    const { client } = await createClient(alice, { clientType: 'confidential' });
    const bob = new TestClient();
    await bob.register('bob@example.com');

    // B 的列表不含 A 的客户端
    const list = await bob.call('GET', '/api/account/clients');
    expect(list.status).toBe(200);
    expect((await bob.json<{ clients: OAuthClient[] }>(list)).clients.some((c) => c.id === client.id)).toBe(false);

    // B 操作 A 的客户端 → 与「不存在」同响应的 404
    const detail = await bob.call('GET', `/api/account/clients/${client.id}`);
    expect(detail.status).toBe(404);
    const patch = await bob.call('PATCH', `/api/account/clients/${client.id}`, { body: { name: 'hijack' } });
    expect(patch.status).toBe(404);
    const rotate = await bob.call('POST', `/api/account/clients/${client.id}/rotate-secret`);
    expect(rotate.status).toBe(404);
    const del = await bob.call('DELETE', `/api/account/clients/${client.id}`);
    expect(del.status).toBe(404);

    // 对照组：A 自己的列表仍可见
    const own = await alice.call('GET', '/api/account/clients');
    expect((await alice.json<{ clients: OAuthClient[] }>(own)).clients.some((c) => c.id === client.id)).toBe(true);
  });

  it('member 创建含 mstor:admin（仅 admin 矩阵有）的客户端 → 400 invalid_scope；admin 同请求 → 201（对照组）', async () => {
    const member = new TestClient();
    await member.register('member@example.com');
    const body = {
      name: 'esc-cli',
      redirect_uris: [REDIRECT_URI],
      allowed_scopes: ['profile:read', 'mstor:admin'],
      resource: RESOURCE,
    };

    const bad = await member.call('POST', '/api/account/clients', { body });
    expect(bad.status).toBe(400);
    expect((await member.json<{ error: string }>(bad)).error).toBe('invalid_scope');

    const admin = await adminClient();
    const okRes = await admin.call('POST', '/api/account/clients', { body });
    expect(okRes.status).toBe(201);
  });
});

describe('confidential 的 authorization_code 全流程', () => {
  it('带 client_secret_post + PKCE 兑换授权码成功；缺 secret → 401 invalid_client', async () => {
    const admin = await adminClient();
    const { client, secret } = await createClient(admin, { clientType: 'confidential', name: 'mstor-web' });

    // 登录用户走授权 → 同意 → 拿 code
    const member = new TestClient();
    await member.register('member@example.com');
    const pkce = await pkcePair();
    const qs = new URLSearchParams({
      response_type: 'code',
      client_id: client.id,
      redirect_uri: REDIRECT_URI,
      scope: 'profile:read offline_access',
      state: 'st-2b',
      code_challenge: pkce.challenge,
      code_challenge_method: 'S256',
      resource: RESOURCE,
    });
    const authRes = await member.call('GET', `/api/oauth/authorize?${qs.toString()}`);
    expect(authRes.status).toBe(302);
    const requestId = new URL(authRes.headers.get('location') ?? '').searchParams.get('request_id') ?? '';
    const approveRes = await member.call('POST', '/api/oauth/consent', {
      body: { request_id: requestId, approve: true },
    });
    expect(approveRes.status).toBe(200);
    const { redirect_to } = await member.json<{ redirect_to: string }>(approveRes);
    const code = new URL(redirect_to).searchParams.get('code') ?? '';
    expect(code.length).toBeGreaterThanOrEqual(40);

    // confidential 缺 secret → 401 invalid_client
    // （resolveClient 在取码/消费之前执行，失败不会消费授权码）
    const anon = new TestClient();
    const noSecret = await tokenRequest(anon, {
      grant_type: 'authorization_code',
      client_id: client.id,
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: pkce.verifier,
    });
    expect(noSecret.status).toBe(401);
    expect((await anon.json<{ error: string }>(noSecret)).error).toBe('invalid_client');

    // 带客户端认证（client_secret_basic，urlencoded 值）重试同一码 → 成功
    const exchange = await tokenRequest(
      anon,
      {
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        code_verifier: pkce.verifier,
      },
      { authorization: basicHeader(client.id, secret!) },
    );
    expect(exchange.status).toBe(200);
    const tokens = await anon.json<TokenResponse>(exchange);
    expect(tokens.refresh_token).toMatch(/^[A-Za-z0-9_-]{43}$/); // 用户流程仍签发 RT
    expect(tokens.scope).toBe('profile:read offline_access');
    const payload = decodeJwt(tokens.access_token);
    expect(payload.sub).not.toBe(client.id); // 用户令牌 sub = 用户 id
    expect(payload.aud).toBe(RESOURCE);

    // 换 code 用的 client_id 与码存储的 client_id 不匹配 → invalid_grant
    //（用另一个 confidential 客户端的合法 secret 兑换第一个客户端的码）
    const other = await createClient(admin, { clientType: 'confidential', name: 'other-cli' });
    const pkce2 = await pkcePair();
    const qs2 = new URLSearchParams({
      response_type: 'code',
      client_id: client.id,
      redirect_uri: REDIRECT_URI,
      scope: 'profile:read offline_access',
      state: 'st-2b',
      code_challenge: pkce2.challenge,
      code_challenge_method: 'S256',
      resource: RESOURCE,
    });
    const authRes2 = await member.call('GET', `/api/oauth/authorize?${qs2.toString()}`);
    expect(authRes2.status).toBe(302);
    const location2 = authRes2.headers.get('location') ?? '';
    let redirect2: string;
    if (location2.startsWith(`${REDIRECT_URI}?`)) {
      redirect2 = location2; // 已有同意记录 → 直发码
    } else {
      const requestId2 = new URL(location2).searchParams.get('request_id') ?? '';
      const approve2 = await member.call('POST', '/api/oauth/consent', {
        body: { request_id: requestId2, approve: true },
      });
      redirect2 = (await member.json<{ redirect_to: string }>(approve2)).redirect_to;
    }
    const code2 = new URL(redirect2).searchParams.get('code') ?? '';
    const mismatch = await tokenRequest(anon, {
      grant_type: 'authorization_code',
      client_id: other.client.id,
      client_secret: other.secret!,
      code: code2,
      redirect_uri: REDIRECT_URI,
      code_verifier: pkce2.verifier,
    });
    expect(mismatch.status).toBe(400);
    expect((await anon.json<{ error: string }>(mismatch)).error).toBe('invalid_grant');
  });
});
