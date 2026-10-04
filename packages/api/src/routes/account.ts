/** /api/account/*：用户自助（会话列表/撤销/撤销其他、改密码） */
import { type SessionListItem, AppError, changePasswordSchema } from '@msauth/shared';
import { Hono } from 'hono';
import { SessionsRepository, UsersRepository, dbOf } from '../db/repositories';
import type { AppEnv } from '../env';
import { ok } from '../lib/response';
import { parseWith, readJsonBody } from '../lib/validation';
import { AUDIT_ACTIONS } from '../modules/audit/events';
import { audit, auditSync } from '../modules/audit/logger';
import { hashPassword, verifyPassword } from '../modules/auth/password';
import { requireAuth } from '../middleware/session';
import { deleteCookie, getCookie } from 'hono/cookie';
import { COOKIES } from '@msauth/shared';

export const accountRoutes = new Hono<AppEnv>();

accountRoutes.use('*', requireAuth());

/** GET /api/account/sessions：当前用户全部会话 */
accountRoutes.get('/sessions', async (c) => {
  const user = c.get('user')!;
  const rows = await new SessionsRepository(dbOf(c.env)).listByUser(user.id);
  const currentId = c.get('sessionIdHash');
  const sessions: SessionListItem[] = rows.map((s) => ({ ...s, current: s.id === currentId }));
  return ok(c, { sessions });
});

/** DELETE /api/account/sessions/:id：撤销自己的某个会话（可以是当前会话） */
accountRoutes.delete('/sessions/:id', async (c) => {
  const user = c.get('user')!;
  const id = c.req.param('id');
  if (!/^[0-9a-f]{64}$/.test(id)) {
    throw new AppError({ code: 'NOT_FOUND', message: '会话不存在' });
  }
  const sessions = new SessionsRepository(dbOf(c.env));
  const target = await sessions.byIdHash(id);
  if (!target || target.userId !== user.id) {
    throw new AppError({ code: 'NOT_FOUND', message: '会话不存在' });
  }
  await sessions.remove(id);
  if (id === c.get('sessionIdHash')) {
    deleteCookie(c, COOKIES.session, { path: '/', secure: true, sameSite: 'Lax', httpOnly: true });
  }
  audit(c, { action: AUDIT_ACTIONS.SESSION_REVOKE, result: 'success', targetType: 'session', targetId: id });
  return ok(c, { ok: true });
});

/** POST /api/account/sessions/revoke-others：撤销除当前外的所有会话 */
accountRoutes.post('/sessions/revoke-others', async (c) => {
  const user = c.get('user')!;
  const revoked = await new SessionsRepository(dbOf(c.env)).removeOthers(user.id, c.get('sessionIdHash'));
  audit(c, {
    action: AUDIT_ACTIONS.SESSION_REVOKE_OTHERS,
    result: 'success',
    targetType: 'user',
    targetId: user.id,
    metadata: { revoked },
  });
  return ok(c, { revoked });
});

/** POST /api/account/password：改密码，成功后撤销其他所有会话（关键操作：审计同步写） */
accountRoutes.post('/password', async (c) => {
  const body = parseWith(changePasswordSchema, await readJsonBody(c));
  const user = c.get('user')!;
  const users = new UsersRepository(dbOf(c.env));
  const internal = await users.byId(user.id);
  if (!internal) throw new AppError({ code: 'UNAUTHORIZED' });

  // 有密码 → 必须验旧密码；无密码（GitHub-only）→ 只允许空当前密码（首设）
  const currentOk = internal.passwordHash
    ? await verifyPassword(body.currentPassword, internal.passwordHash)
    : body.currentPassword === '';
  if (!currentOk) {
    audit(c, { action: AUDIT_ACTIONS.PASSWORD_CHANGE, result: 'failure', reason: 'invalid_current_password', targetType: 'user', targetId: user.id });
    throw new AppError({ code: 'INVALID_CREDENTIALS' });
  }

  await users.updatePassword(user.id, await hashPassword(body.newPassword));
  const revoked = await new SessionsRepository(dbOf(c.env)).removeOthers(user.id, c.get('sessionIdHash'));
  // 关键操作：审计同步写入，失败则拒绝业务
  await auditSync(c, {
    action: AUDIT_ACTIONS.PASSWORD_CHANGE,
    result: 'success',
    targetType: 'user',
    targetId: user.id,
    metadata: { revokedOtherSessions: revoked },
  });
  return ok(c, { ok: true, revoked });
});
