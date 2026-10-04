/**
 * /api/admin/*：平台管理（OAuth 客户端注册/查询/删除）。
 * 全部要求 admin 角色（内联 requireAdmin，账号体系无其他管理域先例，暂不抽公共中间件）。
 */
import { AppError, clientCreateSchema } from '@msauth/shared';
import { Hono } from 'hono';
import {
  OAuthClientsRepository,
  OAuthCodesRepository,
  OAuthConsentsRepository,
  OAuthRefreshTokensRepository,
  dbOf,
} from '../db/repositories';
import type { AppEnv } from '../env';
import { randomToken } from '../lib/crypto';
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

/** POST /api/admin/clients：注册客户端（公共客户端，无 secret，靠 PKCE） */
adminRoutes.post('/clients', async (c) => {
  const body = parseWith(clientCreateSchema, await readJsonBody(c));
  if (body.resource === c.env.APP_BASE_URL) {
    throw new AppError({ code: 'VALIDATION', message: 'resource 不能指向 MSAuth 自身（aud ≠ issuer）' });
  }

  const id = newClientId();
  await new OAuthClientsRepository(dbOf(c.env)).create({
    id,
    name: body.name,
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
    metadata: { resource: body.resource, scopes: [...new Set(body.allowed_scopes)] },
  });
  return ok(c, { client }, 201);
});

/** GET /api/admin/clients/:id */
adminRoutes.get('/clients/:id', async (c) => {
  const client = await new OAuthClientsRepository(dbOf(c.env)).byId(c.req.param('id'));
  if (!client) throw new AppError({ code: 'NOT_FOUND', message: '客户端不存在' });
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
