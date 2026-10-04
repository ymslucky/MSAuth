/** Worker 绑定声明与 Hono 环境类型 */
import type { PublicUser } from '@msauth/shared';

export interface Env {
  /** 主存储（D1） */
  AUTH_DB: D1Database;
  /** KV：GitHub OAuth state 等短命数据 */
  KV: KVNamespace;
  /** SPA 静态资源（Workers Assets） */
  ASSETS: Fetcher;
  /** 登录/注册限速（wrangler.toml unsafe ratelimit binding） */
  LOGIN_RATE_LIMITER?: RateLimit;
  /** 对外基础 URL，如 https://auth.example.com */
  APP_BASE_URL: string;
  /** GitHub OAuth App 凭据（本地在 .dev.vars，线上用 wrangler secret put） */
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
}

/** Hono 泛型环境 */
export type AppEnv = {
  Bindings: Env;
  Variables: {
    requestId: string;
    /** 会话中间件注入：当前用户（未登录为 null） */
    user: PublicUser | null;
    /** 当前会话的 id_hash（未登录为 null） */
    sessionIdHash: string | null;
  };
};
