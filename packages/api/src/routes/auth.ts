/** /api/auth/*：注册、登录、登出、会话查询、CSRF、GitHub OAuth */
import { AppError, COOKIES } from '@msauth/shared';
import { getCookie, setCookie } from 'hono/cookie';
import { Hono } from 'hono';
import { UsersRepository, dbOf } from '../db/repositories';
import type { AppEnv } from '../env';
import { randomToken } from '../lib/crypto';
import { ok } from '../lib/response';
import { parseWith, readJsonBody } from '../lib/validation';
import { AUDIT_ACTIONS } from '../modules/audit/events';
import { audit } from '../modules/audit/logger';
import { beginGithubLogin, githubConfigured, githubResolveUser } from '../modules/auth/github';
import { burnDummyPassword, hashPassword, verifyPassword } from '../modules/auth/password';
import { createSession, revokeCurrentSession } from '../modules/auth/session';
import { loginRateLimit, registerRateLimit } from '../middleware/rate-limit';
import { ulid } from '../lib/ulid';
import { loginSchema, registerSchema } from '@msauth/shared';

export const authRoutes = new Hono<AppEnv>();

/** POST /api/auth/register：注册并自动登录 */
authRoutes.post('/register', registerRateLimit(), async (c) => {
  const body = parseWith(registerSchema, await readJsonBody(c));
  const users = new UsersRepository(dbOf(c.env));

  const existing = await users.byEmail(body.email);
  if (existing) {
    audit(c, { action: AUDIT_ACTIONS.REGISTER, result: 'failure', reason: 'email_taken', targetType: 'user', targetId: existing.id });
    throw new AppError({ code: 'EMAIL_TAKEN' });
  }

  const id = ulid();
  await users.create({ id, email: body.email, displayName: body.displayName, passwordHash: await hashPassword(body.password) });
  await createSession(c, id);
  const user = await users.getPublicUser(id);
  audit(c, { action: AUDIT_ACTIONS.REGISTER, result: 'success', targetType: 'user', targetId: id });
  return ok(c, { user }, 201);
});

/** POST /api/auth/login：密码登录（失败统一消息，防枚举） */
authRoutes.post('/login', loginRateLimit(), async (c) => {
  const body = parseWith(loginSchema, await readJsonBody(c));
  const users = new UsersRepository(dbOf(c.env));

  const user = await users.byEmail(body.email);
  let valid = false;
  if (user?.passwordHash) {
    valid = await verifyPassword(body.password, user.passwordHash);
  } else {
    await burnDummyPassword(); // 时序对齐
  }
  if (!user || !valid) {
    audit(c, { action: AUDIT_ACTIONS.LOGIN, result: 'failure', reason: 'invalid_credentials', targetType: 'user', targetId: user?.id ?? null });
    throw new AppError({ code: 'INVALID_CREDENTIALS' });
  }

  await createSession(c, user.id);
  c.executionCtx.waitUntil(users.touchLastLogin(user.id).catch(() => undefined));
  audit(c, { action: AUDIT_ACTIONS.LOGIN, result: 'success', targetType: 'user', targetId: user.id });
  return ok(c, { user: await users.getPublicUser(user.id) });
});

/** POST /api/auth/logout：撤销当前会话（幂等） */
authRoutes.post('/logout', async (c) => {
  await revokeCurrentSession(c);
  audit(c, { action: AUDIT_ACTIONS.LOGOUT, result: 'success' });
  return ok(c, { ok: true });
});

/** GET /api/auth/session：当前用户（SPA 初始化/刷新保持用） */
authRoutes.get('/session', async (c) => {
  const user = c.get('user');
  if (!user) throw new AppError({ code: 'UNAUTHORIZED' });
  return ok(c, { user, sessionId: c.get('sessionIdHash') });
});

/** GET /api/auth/csrf：下发 CSRF 双提交 Cookie（非 HttpOnly） */
authRoutes.get('/csrf', async (c) => {
  let token = getCookie(c, COOKIES.csrf);
  if (!token) {
    token = randomToken(32);
    setCookie(c, COOKIES.csrf, token, { path: '/', httpOnly: false, secure: true, sameSite: 'Lax' });
  }
  return ok(c, { csrfToken: token });
});

/** GET /api/auth/github：跳转 GitHub 授权 */
authRoutes.get('/github', async (c) => {
  if (!githubConfigured(c.env)) {
    throw new AppError({ code: 'GITHUB_AUTH_FAILED', message: 'GitHub 登录未配置' });
  }
  return c.redirect(await beginGithubLogin(c));
});

/** GET /api/auth/github/callback：GitHub 回调 → 解析用户 → 建会话 → 回 SPA */
authRoutes.get('/github/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const loginUrl = `${c.env.APP_BASE_URL.replace(/\/$/, '')}/login?error=github_failed`;
  if (!code || !state) return c.redirect(loginUrl);
  try {
    const user = await githubResolveUser(c.env, code, state);
    await createSession(c, user.id);
    c.executionCtx.waitUntil(new UsersRepository(dbOf(c.env)).touchLastLogin(user.id).catch(() => undefined));
    audit(c, { action: AUDIT_ACTIONS.LOGIN_GITHUB, result: 'success', targetType: 'user', targetId: user.id });
    return c.redirect(`${c.env.APP_BASE_URL.replace(/\/$/, '')}/account`);
  } catch (err) {
    console.error(`[msauth] ${c.get('requestId')} github callback failed:`, err);
    audit(c, {
      action: AUDIT_ACTIONS.LOGIN_GITHUB,
      result: 'failure',
      reason: err instanceof Error ? err.message.slice(0, 200) : 'unknown',
    });
    return c.redirect(loginUrl);
  }
});
