/**
 * /api/admin/*：平台管理（OAuth 客户端注册/查询/更新/删除/secret 轮换）。
 * 全部要求 admin 角色（内联 requireAdmin，账号体系无其他管理域先例，暂不抽公共中间件）。
 */
import { AppError, clientCreateSchema, clientUpdateSchema, type ClientSecretCreated } from '@msauth/shared';
import { Hono } from 'hono';
import {
  OAuthClientsRepository,
  OAuthCodesRepository,
  OAuthConsentsRepository,
  OAuthRefreshTokensRepository,
  dbOf,
} from '../db/repositories';
import type { AppEnv } from '../env';
import { generateClientSecret } from '../lib/client-auth';
import { randomToken, sha256Hex } from '../lib/crypto';
import { noContent, ok } from '../lib/response';
import { parseWith, readJsonBody } from '../lib/validation';
import { AUDIT_ACTIONS } from '../modules/audit/events';
import { audit, auditSync } from '../modules/audit/logger';
import { requireAuth } from '../middleware/session';

export const adminRoutes = new Hono<AppEnv>();

adminRoutes.use('*', requireAuth());

/** 内联 requireAdmin：非 admin 一律 403 */
adminRoutes.use('*', async (c, next) => {
  if (!c.get('user')?.roles.includes('admin')) {
    throw new AppError({ code: 'FORBIDDEN' });
  }
  await next();
});

/** 生成客户端 id：'c_' + base64url(16B 随机) */
function newClientId(): string {
  return `c_${randomToken(16)}`;
}

/** GET /api/admin/clients：全部客户端（新建在前） */
adminRoutes.get('/clients', async (c) => {
  const clients = await new OAuthClientsRepository(dbOf(c.env)).list();
  return ok(c, { clients });
});

/** POST /api/admin/clients：注册客户端（public 无 secret 靠 PKCE；confidential 生成一次性的 client_secret） */
adminRoutes.post('/clients', async (c) => {
  const body = parseWith(clientCreateSchema, await readJsonBody(c));
  if (body.resource === c.env.APP_BASE_URL) {
    throw new AppError({ code: 'VALIDATION', message: 'resource 不能指向 MSAuth 自身（aud ≠ issuer）' });
  }

  const id = newClientId();
  // confidential 生成 secret 并只存 SHA-256 hex；public 恒为 null
  const clientSecret = body.clientType === 'confidential' ? generateClientSecret() : null;
  await new OAuthClientsRepository(dbOf(c.env)).create({
    id,
    name: body.name,
    clientType: body.clientType,
    clientSecretHash: clientSecret === null ? null : await sha256Hex(clientSecret),
    redirectUris: body.redirect_uris,
    allowedScopes: [...new Set(body.allowed_scopes)],
    resource: body.resource,
    accessTokenTtlSeconds: body.access_token_ttl_seconds ?? 900,
    refreshTokenTtlSeconds: body.refresh_token_ttl_seconds ?? 604_800,
    createdBy: c.get('user')!.id,
  });
  const client = await new OAuthClientsRepository(dbOf(c.env)).byId(id);
  audit(c, {
    action: AUDIT_ACTIONS.OAUTH_CLIENT_CREATE,
    result: 'success',
    targetType: 'client',
    targetId: id,
    metadata: { clientType: body.clientType, resource: body.resource, scopes: [...new Set(body.allowed_scopes)] },
  });
  // clientSecret 明文仅此一次返回（库中只存哈希，之后无法找回，只能轮换）；
  // public 保持 { client } 形状（Phase 2 E2E 依赖）
  return ok(c, clientSecret === null ? { client } : { client, clientSecret }, 201);
});

/** POST /api/admin/clients/:id/rotate-secret：轮换机密客户端 secret（public 无 secret → 400） */
adminRoutes.post('/clients/:id/rotate-secret', async (c) => {
  const id = c.req.param('id');
  const clients = new OAuthClientsRepository(dbOf(c.env));
  const client = await clients.byId(id);
  if (!client) throw new AppError({ code: 'NOT_FOUND', message: '客户端不存在' });
  if (client.clientType !== 'confidential') {
    throw new AppError({ code: 'VALIDATION', message: '公共客户端无 secret，无需轮换' });
  }

  const clientSecret = generateClientSecret();
  await clients.updateSecretHash(id, await sha256Hex(clientSecret));
  audit(c, {
    action: AUDIT_ACTIONS.OAUTH_CLIENT_ROTATE_SECRET,
    result: 'success',
    targetType: 'client',
    targetId: id,
  });
  // 新 secret 仅此一次返回（ClientSecretCreated），旧 secret 立即失效
  return ok(c, { id, clientSecret } satisfies ClientSecretCreated);
});

/** GET /api/admin/clients/:id */
adminRoutes.get('/clients/:id', async (c) => {
  const client = await new OAuthClientsRepository(dbOf(c.env)).byId(c.req.param('id'));
  if (!client) throw new AppError({ code: 'NOT_FOUND', message: '客户端不存在' });
  return ok(c, { client });
});

/**
 * PATCH /api/admin/clients/:id：部分更新（name/redirect_uris/allowed_scopes/resource/TTL）。
 * client_type 不可修改——公共↔机密涉及 secret 语义变化，需删除后重新注册
 * （clientUpdateSchema 为 strictObject，请求中出现该键即 400）。
 */
adminRoutes.patch('/clients/:id', async (c) => {
  const id = c.req.param('id');
  const body = parseWith(clientUpdateSchema, await readJsonBody(c));
  if (body.resource !== undefined && body.resource === c.env.APP_BASE_URL) {
    throw new AppError({ code: 'VALIDATION', message: 'resource 不能指向 MSAuth 自身（aud ≠ issuer）' });
  }

  const clients = new OAuthClientsRepository(dbOf(c.env));
  if (!(await clients.byId(id))) {
    throw new AppError({ code: 'NOT_FOUND', message: '客户端不存在' });
  }
  await clients.update(id, {
    name: body.name,
    redirectUris: body.redirect_uris,
    allowedScopes: body.allowed_scopes === undefined ? undefined : [...new Set(body.allowed_scopes)],
    resource: body.resource,
    accessTokenTtlSeconds: body.access_token_ttl_seconds,
    refreshTokenTtlSeconds: body.refresh_token_ttl_seconds,
  });
  const client = await clients.byId(id);
  audit(c, {
    action: AUDIT_ACTIONS.OAUTH_CLIENT_UPDATE,
    result: 'success',
    targetType: 'client',
    targetId: id,
    metadata: { fields: Object.keys(body) },
  });
  return ok(c, { client });
});

/** DELETE /api/admin/clients/:id：级联删授权码/同意记录并撤销全部刷新令牌 */
adminRoutes.delete('/clients/:id', async (c) => {
  const id = c.req.param('id');
  const db = dbOf(c.env);
  const clients = new OAuthClientsRepository(db);
  if (!(await clients.remove(id))) {
    throw new AppError({ code: 'NOT_FOUND', message: '客户端不存在' });
  }
  const revoked = await new OAuthRefreshTokensRepository(db).revokeByClient(id);
  await new OAuthCodesRepository(db).removeByClient(id);
  await new OAuthConsentsRepository(db).removeByClient(id);
  await auditSync(c, {
    action: AUDIT_ACTIONS.OAUTH_CLIENT_DELETE,
    result: 'success',
    targetType: 'client',
    targetId: id,
    metadata: { revokedRefreshTokens: revoked },
  });
  return noContent(c);
});
