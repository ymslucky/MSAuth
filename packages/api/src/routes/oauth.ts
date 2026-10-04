/**
 * /api/oauth/*：OAuth 2.1 公共客户端授权服务器。
 * - GET /authorize：校验（客户端/回调/受众/PKCE/scope 三方交集）→ 已同意直发码，否则转 SPA 同意页
 * - GET /consent/request：同意页数据（KV 短暂保存的待授权请求）
 * - POST /consent：同意/拒绝 → 发码或回 access_denied
 * - POST /token：authorization_code（PKCE）与 refresh_token（轮换 + 重用检测）；公开端点（csrf 豁免）
 * - GET /jwks：RS256 公钥（资源服务器验签）
 */
import {
  type ConsentRequestInfo,
  type TokenResponse,
  DEFAULT_TTL,
  ROLE_SCOPES,
  SCOPE_LIST,
  type Role,
  AppError,
  authorizeQuerySchema,
  consentDecisionSchema,
} from '@msauth/shared';
import type { Context } from 'hono';
import { Hono } from 'hono';
import {
  OAuthClientsRepository,
  OAuthCodesRepository,
  OAuthConsentsRepository,
  OAuthRefreshTokensRepository,
  dbOf,
} from '../db/repositories';
import type { AppEnv, Env } from '../env';
import { randomToken, sha256Hex, timingSafeEqualStr } from '../lib/crypto';
import { getSigningKey, pkceChallenge, signAccessToken } from '../lib/oauth';
import { ok, redirect } from '../lib/response';
import { ulid } from '../lib/ulid';
import { parseWith, readJsonBody } from '../lib/validation';
import { AUDIT_ACTIONS } from '../modules/audit/events';
import { audit } from '../modules/audit/logger';

export const oauthRoutes = new Hono<AppEnv>();

/** 待同意请求在 KV 中的保存时长（秒） */
const CONSENT_REQ_TTL = 600;

/** 授权码 / 刷新令牌明文长度（字节）→ base64url 后 43 字符 */
const TOKEN_BYTES = 32;

/** 同意前的授权请求（authorize 校验通过后暂存 KV，consent 端点取回重放） */
interface PendingConsent {
  clientId: string;
  userId: string;
  redirectUri: string;
  resource: string;
  /** 已裁剪的最终授予 scope */
  scope: string[];
  state: string | null;
  codeChallenge: string;
}

/** 角色优先级：取用户最高角色决定可授权 scope 上限 */
const ROLE_RANK: Record<Role, number> = { admin: 3, member: 2, viewer: 1, none: 0 };

function highestRole(roles: Role[]): Role {
  return roles.reduce<Role>((top, r) => (ROLE_RANK[r] > ROLE_RANK[top] ? r : top), 'none');
}

function kvKey(requestId: string): string {
  return `oauth:req:${requestId}`;
}

async function loadPending(env: Env, requestId: string): Promise<PendingConsent> {
  const raw = requestId ? await env.KV.get(kvKey(requestId)) : null;
  if (!raw) {
    throw new AppError({ code: 'INVALID_REQUEST', message: '授权请求已过期或不存在' });
  }
  return JSON.parse(raw) as PendingConsent;
}

/** 发授权码（60 秒一次性）并构造回调地址；state 原样回显（URL 编码） */
async function issueAuthorizationCode(c: Context<AppEnv>, p: PendingConsent): Promise<string> {
  const code = randomToken(TOKEN_BYTES);
  const now = Date.now();
  await new OAuthCodesRepository(dbOf(c.env)).create({
    codeHash: await sha256Hex(code),
    clientId: p.clientId,
    userId: p.userId,
    resource: p.resource,
    scope: p.scope.join(' '),
    redirectUri: p.redirectUri,
    codeChallenge: p.codeChallenge,
    expiresAt: now + DEFAULT_TTL.authorizationCode * 1000,
    createdAt: now,
  });
  const url = new URL(p.redirectUri);
  url.searchParams.set('code', code);
  if (p.state !== null) url.searchParams.set('state', p.state);
  return url.toString();
}

function deniedRedirect(p: PendingConsent): string {
  const url = new URL(p.redirectUri);
  url.searchParams.set('error', 'access_denied');
  if (p.state !== null) url.searchParams.set('state', p.state);
  return url.toString();
}

// ===== 授权端点 =====

/** GET /api/oauth/authorize：未登录 401（SPA 登录后回跳）；校验通过后发码或转同意页 */
oauthRoutes.get('/authorize', async (c) => {
  const user = c.get('user');
  if (!user) throw new AppError({ code: 'UNAUTHORIZED' });

  const q = parseWith(authorizeQuerySchema, c.req.query());

  const clients = new OAuthClientsRepository(dbOf(c.env));
  const client = await clients.byId(q.client_id);
  if (!client) throw new AppError({ code: 'INVALID_CLIENT', message: '客户端不存在' });
  if (!client.redirectUris.includes(q.redirect_uri)) {
    throw new AppError({ code: 'INVALID_REDIRECT_URI' });
  }
  if (q.resource !== undefined && q.resource !== client.resource) {
    throw new AppError({ code: 'INVALID_REQUEST', message: 'resource 与客户端注册的受众不一致' });
  }

  // 实际授予 scope = 用户最高角色上限 ∩ 客户端允许 ∩ 请求（按 SCOPE_LIST 顺序稳定输出）
  const roleScopeSet = ROLE_SCOPES[highestRole(user.roles)];
  const requested = new Set(q.scope.split(/\s+/).filter(Boolean));
  const effective = SCOPE_LIST.filter(
    (s) => requested.has(s) && client.allowedScopes.includes(s) && roleScopeSet.includes(s),
  );
  if (effective.length === 0) {
    throw new AppError({ code: 'INVALID_SCOPE' });
  }

  const pending: PendingConsent = {
    clientId: client.id,
    userId: user.id,
    redirectUri: q.redirect_uri,
    resource: client.resource,
    scope: effective,
    state: q.state ?? null,
    codeChallenge: q.code_challenge,
  };

  // 已有同意且覆盖本次全部 scope → 直接发码
  const consented = await new OAuthConsentsRepository(dbOf(c.env)).find(user.id, client.id);
  if (consented !== null && effective.every((s) => consented.includes(s))) {
    const redirectTo = await issueAuthorizationCode(c, pending);
    audit(c, {
      action: AUDIT_ACTIONS.OAUTH_AUTHORIZE,
      result: 'success',
      targetType: 'client',
      targetId: client.id,
      metadata: { consent: 'existing', scope: effective.join(' ') },
    });
    return redirect(c, redirectTo);
  }

  const requestId = `r_${randomToken(18)}`;
  await c.env.KV.put(kvKey(requestId), JSON.stringify(pending), { expirationTtl: CONSENT_REQ_TTL });
  audit(c, {
    action: AUDIT_ACTIONS.OAUTH_AUTHORIZE,
    result: 'success',
    targetType: 'client',
    targetId: client.id,
    metadata: { consent: 'required', scope: effective.join(' ') },
  });
  return redirect(c, `${c.env.APP_BASE_URL.replace(/\/$/, '')}/oauth/consent?request_id=${encodeURIComponent(requestId)}`);
});

// ===== 同意端点 =====

/** GET /api/oauth/consent/request：同意页展示数据 */
oauthRoutes.get('/consent/request', async (c) => {
  const user = c.get('user');
  if (!user) throw new AppError({ code: 'UNAUTHORIZED' });

  const pending = await loadPending(c.env, c.req.query('request_id') ?? '');
  if (pending.userId !== user.id) throw new AppError({ code: 'FORBIDDEN' });
  const client = await new OAuthClientsRepository(dbOf(c.env)).byId(pending.clientId);
  if (!client) throw new AppError({ code: 'INVALID_REQUEST', message: '授权请求已过期或不存在' });

  return ok(c, {
    client_name: client.name,
    client_id: client.id,
    scope: pending.scope,
    redirect_host: new URL(pending.redirectUri).host,
    resource: pending.resource,
  } satisfies ConsentRequestInfo);
});

/** POST /api/oauth/consent：同意（发码）/ 拒绝（access_denied 回调），一次性消费 KV 请求 */
oauthRoutes.post('/consent', async (c) => {
  const user = c.get('user');
  if (!user) throw new AppError({ code: 'UNAUTHORIZED' });

  const body = parseWith(consentDecisionSchema, await readJsonBody(c));
  const pending = await loadPending(c.env, body.request_id);
  if (pending.userId !== user.id) throw new AppError({ code: 'FORBIDDEN' });
  await c.env.KV.delete(kvKey(body.request_id));

  if (body.approve) {
    await new OAuthConsentsRepository(dbOf(c.env)).upsert(user.id, pending.clientId, pending.scope);
    const redirectTo = await issueAuthorizationCode(c, pending);
    audit(c, {
      action: AUDIT_ACTIONS.OAUTH_CONSENT_APPROVE,
      result: 'success',
      targetType: 'client',
      targetId: pending.clientId,
      metadata: { scope: pending.scope.join(' ') },
    });
    return ok(c, { redirect_to: redirectTo });
  }

  audit(c, {
    action: AUDIT_ACTIONS.OAUTH_CONSENT_DENY,
    result: 'denied',
    targetType: 'client',
    targetId: pending.clientId,
  });
  return ok(c, { redirect_to: deniedRedirect(pending) });
});

// ===== 令牌端点（公开，无 Cookie 鉴权；csrf.ts 已豁免）=====

/** 表单/JSON 值宽松取字符串（RFC 6749 表单端点） */
function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

const TOKEN_HEADERS = { 'Cache-Control': 'no-store', Pragma: 'no-cache' };

/** POST /api/oauth/token */
oauthRoutes.post('/token', async (c) => {
  // 兼容 application/x-www-form-urlencoded（RFC 6749）与 JSON（内部调试）
  const contentType = c.req.header('content-type') ?? '';
  const form: Record<string, unknown> = contentType.includes('application/x-www-form-urlencoded')
    ? await c.req.parseBody()
    : ((await readJsonBody(c)) as Record<string, unknown> | null) ?? {};

  const grantType = str(form.grant_type);
  if (!grantType) throw new AppError({ code: 'INVALID_REQUEST', message: '缺少 grant_type' });
  if (grantType === 'authorization_code') return authorizationCodeGrant(c, form);
  if (grantType === 'refresh_token') return refreshTokenGrant(c, form);
  throw new AppError({ code: 'UNSUPPORTED_GRANT_TYPE' });
});

/** authorization_code + PKCE 兑换 */
async function authorizationCodeGrant(c: Context<AppEnv>, form: Record<string, unknown>) {
  const clientId = str(form.client_id);
  const code = str(form.code);
  const redirectUri = str(form.redirect_uri);
  const codeVerifier = str(form.code_verifier);
  if (!clientId || !code || !redirectUri || !codeVerifier) {
    throw new AppError({ code: 'INVALID_REQUEST', message: '缺少必要参数' });
  }

  const client = await new OAuthClientsRepository(dbOf(c.env)).byId(clientId);
  if (!client) throw new AppError({ code: 'INVALID_CLIENT' });

  const codes = new OAuthCodesRepository(dbOf(c.env));
  const refresh = new OAuthRefreshTokensRepository(dbOf(c.env));
  const codeHash = await sha256Hex(code);
  const record = await codes.byCodeHash(codeHash);
  const now = Date.now();

  if (!record) throw new AppError({ code: 'INVALID_GRANT' });

  // 授权码重放：撤销该用户在该客户端下的全部刷新令牌链
  if (record.consumedAt !== null || !(await codes.consume(codeHash, now))) {
    await refresh.revokeByClientAndUser(record.clientId, record.userId);
    audit(c, {
      action: AUDIT_ACTIONS.OAUTH_CODE_REUSE,
      result: 'failure',
      reason: 'code_reuse',
      targetType: 'client',
      targetId: record.clientId,
      actorId: record.userId,
    });
    throw new AppError({ code: 'INVALID_GRANT' });
  }

  if (now > record.expiresAt) throw new AppError({ code: 'INVALID_GRANT' });
  if (record.clientId !== clientId || record.redirectUri !== redirectUri) {
    throw new AppError({ code: 'INVALID_GRANT' });
  }
  // PKCE S256：base64url(SHA-256(verifier)) 必须与存储的 challenge 一致
  if (!timingSafeEqualStr(await pkceChallenge(codeVerifier), record.codeChallenge)) {
    throw new AppError({ code: 'INVALID_GRANT' });
  }

  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(c.env, {
      userId: record.userId,
      resource: record.resource,
      clientId,
      scope: record.scope,
      ttlSeconds: client.accessTokenTtlSeconds,
    }),
    issueRefreshToken(c, {
      familyId: ulid(),
      clientId,
      userId: record.userId,
      resource: record.resource,
      scope: record.scope,
      ttlSeconds: client.refreshTokenTtlSeconds,
    }),
  ]);

  audit(c, {
    action: AUDIT_ACTIONS.OAUTH_TOKEN_ISSUE,
    result: 'success',
    targetType: 'client',
    targetId: clientId,
    actorId: record.userId,
    metadata: { grant_type: 'authorization_code', scope: record.scope }, // 不记录令牌本体
  });
  return c.json(
    {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: client.accessTokenTtlSeconds,
      refresh_token: refreshToken,
      scope: record.scope,
    } satisfies TokenResponse,
    200,
    TOKEN_HEADERS,
  );
}

/** refresh_token 轮换：旧 RT 立即失效，重用则整链撤销 */
async function refreshTokenGrant(c: Context<AppEnv>, form: Record<string, unknown>) {
  const clientId = str(form.client_id);
  const token = str(form.refresh_token);
  if (!clientId || !token) throw new AppError({ code: 'INVALID_REQUEST', message: '缺少必要参数' });

  const client = await new OAuthClientsRepository(dbOf(c.env)).byId(clientId);
  if (!client) throw new AppError({ code: 'INVALID_CLIENT' });

  const refresh = new OAuthRefreshTokensRepository(dbOf(c.env));
  const record = await refresh.byTokenHash(await sha256Hex(token));
  const now = Date.now();

  if (!record || record.clientId !== clientId || now > record.expiresAt) {
    throw new AppError({ code: 'INVALID_GRANT' });
  }

  // 重用检测：已轮换/已撤销的 RT 再次出现 → 撤销整个 family
  if (record.revokedAt !== null || record.rotatedAt !== null || !(await refresh.rotate(record.id, now))) {
    await refresh.revokeFamily(record.familyId, now);
    audit(c, {
      action: AUDIT_ACTIONS.OAUTH_TOKEN_REUSE,
      result: 'failure',
      reason: 'refresh_reuse',
      targetType: 'client',
      targetId: clientId,
      actorId: record.userId,
    });
    throw new AppError({ code: 'INVALID_GRANT' });
  }

  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(c.env, {
      userId: record.userId,
      resource: record.resource,
      clientId,
      scope: record.scope,
      ttlSeconds: client.accessTokenTtlSeconds,
    }),
    issueRefreshToken(c, {
      familyId: record.familyId, // 轮换保持同链
      clientId,
      userId: record.userId,
      resource: record.resource,
      scope: record.scope,
      ttlSeconds: client.refreshTokenTtlSeconds,
    }),
  ]);

  audit(c, {
    action: AUDIT_ACTIONS.OAUTH_TOKEN_REFRESH,
    result: 'success',
    targetType: 'client',
    targetId: clientId,
    actorId: record.userId,
    metadata: { grant_type: 'refresh_token', scope: record.scope },
  });
  return c.json(
    {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: client.accessTokenTtlSeconds,
      refresh_token: refreshToken,
      scope: record.scope,
    } satisfies TokenResponse,
    200,
    TOKEN_HEADERS,
  );
}

/** 生成刷新令牌明文（43 字符）并入库（SHA-256 hex），返回明文 */
async function issueRefreshToken(
  c: Context<AppEnv>,
  input: { familyId: string; clientId: string; userId: string; resource: string; scope: string; ttlSeconds: number },
): Promise<string> {
  const raw = randomToken(TOKEN_BYTES);
  await new OAuthRefreshTokensRepository(dbOf(c.env)).create({
    id: ulid(),
    familyId: input.familyId,
    tokenHash: await sha256Hex(raw),
    clientId: input.clientId,
    userId: input.userId,
    resource: input.resource,
    scope: input.scope,
    expiresAt: Date.now() + input.ttlSeconds * 1000,
    createdAt: Date.now(),
  });
  return raw;
}

// ===== JWKS =====

/** GET /api/oauth/jwks：RS256 公钥（资源服务器本地验签） */
oauthRoutes.get('/jwks', async (c) => {
  const { publicJwk } = await getSigningKey(c.env);
  return c.json({ keys: [publicJwk] }, 200, { 'Cache-Control': 'public, max-age=300' });
});
