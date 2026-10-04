/**
 * /api/account/clients*：OAuth 客户端自助管理——归属权（owner）模型，谁创建谁管理。
 * - 列表：仅返回 created_by = 当前用户的客户端；
 * - 详情/更新/轮换/删除：仅限本人创建的客户端，他人的一律 404（与「不存在」同响应，
 *   防止探测枚举 client_id）；
 * - 创建：任意登录用户；allowed_scopes 不得超出创建者最高角色的可授权矩阵
 *   （ROLE_SCOPES，复用授权端点同源的 highestRole）。
 */
import {
  type OAuthClient,
  AppError,
  ROLE_SCOPES,
  clientCreateSchema,
  clientUpdateSchema,
  type ClientSecretCreated,
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
import type { AppEnv } from '../env';
import { generateClientSecret } from '../lib/client-auth';
import { randomToken, sha256Hex } from '../lib/crypto';
import { highestRole } from '../lib/oauth';
import { noContent, ok } from '../lib/response';
import { parseWith, readJsonBody } from '../lib/validation';
import { AUDIT_ACTIONS } from '../modules/audit/events';
import { audit, auditSync } from '../modules/audit/logger';
import { requireAuth } from '../middleware/session';

export const clientRoutes = new Hono<AppEnv>();

clientRoutes.use('*', requireAuth());

/** 生成客户端 id：'c_' + base64url(16B 随机) */
function newClientId(): string {
  return `c_${randomToken(16)}`;
}

/**
 * 归属权校验：取客户端并确认属于当前用户。
 * 不存在或非本人创建 → 404（与「不存在」完全同响应，防枚举探测他人 client_id）。
 */
async function requireOwnedClient(c: Context<AppEnv>, id: string): Promise<OAuthClient> {
  const client = await new OAuthClientsRepository(dbOf(c.env)).byId(id);
  if (!client || client.createdBy !== c.get('user')!.id) {
    throw new AppError({ code: 'NOT_FOUND', message: '客户端不存在' });
  }
  return client;
}

/** GET /api/account/clients：当前用户创建的客户端（新建在前） */
clientRoutes.get('/clients', async (c) => {
  const clients = await new OAuthClientsRepository(dbOf(c.env)).listByOwner(c.get('user')!.id);
  return ok(c, { clients });
});

/**
 * POST /api/account/clients：注册客户端（public 无 secret 靠 PKCE；
 * confidential 生成一次性的 client_secret）。allowed_scopes 以上限 =
 * 创建者最高角色的 ROLE_SCOPES 矩阵为界，越界 → 400 invalid_scope。
 */
clientRoutes.post('/clients', async (c) => {
  const user = c.get('user')!;
  const body = parseWith(clientCreateSchema, await readJsonBody(c));
  if (body.resource === c.env.APP_BASE_URL) {
    throw new AppError({ code: 'VALIDATION', message: 'resource 不能指向 MSAuth 自身（aud ≠ issuer）' });
  }
  const scopes = [...new Set(body.allowed_scopes)];
  const roleScopeSet = ROLE_SCOPES[highestRole(user.roles)];
  if (scopes.some((s) => !roleScopeSet.includes(s))) {
    throw new AppError({ code: 'INVALID_SCOPE', message: '超出你的角色可授权的 scope' });
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
    allowedScopes: scopes,
    resource: body.resource,
    accessTokenTtlSeconds: body.access_token_ttl_seconds ?? 900,
    refreshTokenTtlSeconds: body.refresh_token_ttl_seconds ?? 604_800,
    createdBy: user.id,
  });
  const client = await new OAuthClientsRepository(dbOf(c.env)).byId(id);
  audit(c, {
    action: AUDIT_ACTIONS.OAUTH_CLIENT_CREATE,
    result: 'success',
    targetType: 'client',
    targetId: id,
    metadata: { clientType: body.clientType, resource: body.resource, scopes },
  });
  // clientSecret 明文仅此一次返回（库中只存哈希，之后无法找回，只能轮换）；
  // public 保持 { client } 形状（Phase 2 E2E 依赖）
  return ok(c, clientSecret === null ? { client } : { client, clientSecret }, 201);
});

/** GET /api/account/clients/:id：仅归属者可见（他人 → 404 防枚举） */
clientRoutes.get('/clients/:id', async (c) => {
  const client = await requireOwnedClient(c, c.req.param('id'));
  return ok(c, { client });
});

/**
 * PATCH /api/account/clients/:id：归属者的部分更新（name/redirect_uris/allowed_scopes/resource/TTL）。
 * client_type 不可修改——公共↔机密涉及 secret 语义变化，需删除后重新注册
 * （clientUpdateSchema 为 strictObject，请求中出现该键即 400）。
 */
clientRoutes.patch('/clients/:id', async (c) => {
  const id = c.req.param('id');
  await requireOwnedClient(c, id);
  const body = parseWith(clientUpdateSchema, await readJsonBody(c));
  if (body.resource !== undefined && body.resource === c.env.APP_BASE_URL) {
    throw new AppError({ code: 'VALIDATION', message: 'resource 不能指向 MSAuth 自身（aud ≠ issuer）' });
  }

  const clients = new OAuthClientsRepository(dbOf(c.env));
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

/** POST /api/account/clients/:id/rotate-secret：归属者轮换机密客户端 secret（public 无 secret → 400） */
clientRoutes.post('/clients/:id/rotate-secret', async (c) => {
  const id = c.req.param('id');
  const client = await requireOwnedClient(c, id);
  if (client.clientType !== 'confidential') {
    throw new AppError({ code: 'VALIDATION', message: '公共客户端无 secret，无需轮换' });
  }

  const clientSecret = generateClientSecret();
  await new OAuthClientsRepository(dbOf(c.env)).updateSecretHash(id, await sha256Hex(clientSecret));
  audit(c, {
    action: AUDIT_ACTIONS.OAUTH_CLIENT_ROTATE_SECRET,
    result: 'success',
    targetType: 'client',
    targetId: id,
  });
  // 新 secret 仅此一次返回（ClientSecretCreated），旧 secret 立即失效
  return ok(c, { id, clientSecret } satisfies ClientSecretCreated);
});

/** DELETE /api/account/clients/:id：归属者删除；级联删授权码/同意记录并撤销全部刷新令牌 */
clientRoutes.delete('/clients/:id', async (c) => {
  const id = c.req.param('id');
  await requireOwnedClient(c, id);
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
