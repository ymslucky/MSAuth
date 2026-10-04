/**
 * GitHub OAuth 登录：
 * - state 随机生成存 KV（10 分钟 TTL），验证后立即删除（一次性）
 * - code 换 token → 拉取用户与邮箱（primary verified 优先）
 * - 解析策略：github_id 已绑定 → 登录；邮箱命中已有账号 → 自动绑定（已确认的设计决策）；
 *   否则新建无密码用户（角色默认 member）
 * - fetch 可注入，便于测试离线运行
 */
import { type PublicUser, AppError } from '@msauth/shared';
import type { Context } from 'hono';
import { UsersRepository, dbOf } from '../../db/repositories';
import { randomToken } from '../../lib/crypto';
import { ulid } from '../../lib/ulid';
import type { AppEnv, Env } from '../../env';

const AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const TOKEN_URL = 'https://github.com/login/oauth/access_token';
const API_USER_URL = 'https://api.github.com/user';
const API_EMAILS_URL = 'https://api.github.com/user/emails';
const STATE_TTL_SECONDS = 600;

/** 可注入的 fetch（测试用），签名宽松以兼容全局 fetch */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** 单次请求超时：本机网络对 github.com 偶发首连挂起，必须设上限 */
const FETCH_TIMEOUT_MS = 8_000;

/** 总尝试次数（含首次） */
const FETCH_ATTEMPTS = 3;

/**
 * 带超时与重试的 GitHub 请求：
 * - 网络错误（超时/重置/workerd internal error）→ 重试
 * - 5xx / 429 → 重试；4xx 不重试（业务错误）
 */
async function fetchWithRetry(url: string, init: RequestInit, fetchImpl: FetchLike): Promise<Response> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt++) {
    if (attempt > 1) await new Promise((resolve) => setTimeout(resolve, 300 * (attempt - 1)));
    try {
      const res = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (res.status >= 500 || res.status === 429) {
        lastError = new Error(`GitHub HTTP ${res.status}`);
        continue;
      }
      return res;
    } catch (err) {
      lastError = err;
    }
  }
  throw new AppError({ code: 'GITHUB_AUTH_FAILED', message: '连接 GitHub 失败（网络超时或不稳定），请重试', cause: lastError });
}

interface GithubUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
}

interface GithubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
}

export function githubConfigured(env: Env): boolean {
  return Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET);
}

function callbackUrl(env: Env): string {
  return `${env.APP_BASE_URL.replace(/\/$/, '')}/api/auth/github/callback`;
}

/** 第一步：生成 state 存 KV，返回 GitHub authorize 跳转地址 */
export async function beginGithubLogin(c: Context<AppEnv>): Promise<string> {
  const state = randomToken(32);
  await c.env.KV.put(`gh_state:${state}`, String(Date.now()), { expirationTtl: STATE_TTL_SECONDS });
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set('client_id', c.env.GITHUB_CLIENT_ID!);
  url.searchParams.set('redirect_uri', callbackUrl(c.env));
  url.searchParams.set('scope', 'read:user user:email');
  url.searchParams.set('state', state);
  return url.toString();
}

/** 第二步：校验 state（一次性）并换 token、拉取资料，解析/创建用户 */
export async function githubResolveUser(
  env: Env,
  code: string,
  state: string,
  fetchImpl: FetchLike = (input, init) => fetch(input, init),
): Promise<PublicUser> {
  const stateKey = `gh_state:${state}`;
  const stored = await env.KV.get(stateKey);
  if (stored === null) {
    throw new AppError({ code: 'GITHUB_AUTH_FAILED', message: '登录状态无效或已过期，请重试' });
  }
  // 用后立即删除：state 只能消费一次（防重放）
  await env.KV.delete(stateKey);

  // code 换 access_token
  const tokenRes = await fetchWithRetry(
    TOKEN_URL,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: callbackUrl(env),
      }),
    },
    fetchImpl,
  );
  const tokenBody = (await tokenRes.json().catch(() => null)) as { access_token?: string } | null;
  const accessToken = tokenBody?.access_token;
  if (!tokenRes.ok || !accessToken) {
    throw new AppError({ code: 'GITHUB_AUTH_FAILED', message: 'GitHub 授权码交换失败' });
  }
  // GitHub REST API 强制要求 User-Agent（workerd 的 fetch 默认不携带，会 403）
  const authHeaders = {
    authorization: `Bearer ${accessToken}`,
    accept: 'application/vnd.github+json',
    'user-agent': 'MSAuth-Workers/0.2',
    'x-github-api-version': '2022-11-28',
  };

  const [userRes, emailsRes] = await Promise.all([
    fetchWithRetry(API_USER_URL, { headers: authHeaders }, fetchImpl),
    fetchWithRetry(API_EMAILS_URL, { headers: authHeaders }, fetchImpl),
  ]);
  if (!userRes.ok || !emailsRes.ok) {
    // 状态码进审计 reason，便于排查；不暴露给最终用户
    throw new AppError({ code: 'GITHUB_AUTH_FAILED', message: `获取 GitHub 用户信息失败（${userRes.status}/${emailsRes.status}）` });
  }
  const ghUser = (await userRes.json()) as GithubUser;
  const ghEmails = (await emailsRes.json()) as GithubEmail[];
  const email =
    ghEmails.find((e) => e.primary && e.verified)?.email ??
    ghEmails.find((e) => e.verified)?.email ??
    `${ghUser.login}@users.noreply.github.com`;

  const users = new UsersRepository(dbOf(env));

  // 1) github_id 已绑定 → 直接登录
  const byGithub = await users.byGithubId(String(ghUser.id));
  if (byGithub) {
    const publicUser = await users.getPublicUser(byGithub.id);
    if (publicUser) return publicUser;
  }

  // 2) 邮箱命中已有账号 → 自动绑定
  const byEmail = await users.byEmail(email);
  if (byEmail) {
    await users.linkGithub({
      githubId: String(ghUser.id),
      userId: byEmail.id,
      login: ghUser.login,
      email,
    });
    const publicUser = await users.getPublicUser(byEmail.id);
    if (publicUser) return publicUser;
  }

  // 3) 新用户：无密码，仅 GitHub 登录
  const newId = ulid();
  await users.create({
    id: newId,
    email,
    displayName: ghUser.name || ghUser.login,
    passwordHash: null,
  });
  await users.linkGithub({ githubId: String(ghUser.id), userId: newId, login: ghUser.login, email });
  const created = await users.getPublicUser(newId);
  if (!created) {
    throw new AppError({ code: 'INTERNAL', message: 'GitHub 用户创建失败' });
  }
  return created;
}
