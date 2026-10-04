/** 集成测试助手：带 Cookie/CSRF/IP 的请求客户端 + 直连 D1 断言工具 */
import { COOKIES } from '@msauth/shared';
import { env } from 'cloudflare:test';
import { afterEach } from 'vitest';
import app from '../src/index';

/** 自动递增的 IP，避免触发限速（限速测试可用 opts.ip 固定） */
let ipAuto = 1;

/** 本文件内创建的全部客户端：afterEach 统一冲刷 waitUntil，避免隔离存储泄漏 */
const registry: TestClient[] = [];

afterEach(async () => {
  const clients = registry.splice(0);
  await Promise.all(clients.map((c) => c.flush().catch(() => undefined)));
});

export class TestClient {
  private cookies = new Map<string, string>();
  private pending: Promise<unknown>[] = [];
  readonly env = env;

  constructor() {
    registry.push(this);
  }

  /** 等待 waitUntil 中的异步任务（审计写入等）完成 */
  async flush(): Promise<void> {
    await Promise.all(this.pending.splice(0));
  }

  async call(
    method: string,
    path: string,
    opts: { body?: unknown; form?: Record<string, string>; csrf?: boolean; ip?: string; headers?: Record<string, string> } = {},
  ): Promise<Response> {
    const headers: Record<string, string> = { 'user-agent': 'vitest-agent', ...(opts.headers ?? {}) };
    let body: string | undefined;
    if (opts.body !== undefined) {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(opts.body);
    } else if (opts.form !== undefined) {
      // RFC 6749 表单端点（/api/oauth/token）用 urlencoded 编码
      headers['content-type'] = 'application/x-www-form-urlencoded';
      body = new URLSearchParams(opts.form).toString();
    }
    const csrfToken = this.cookies.get(COOKIES.csrf);
    if (csrfToken && (opts.csrf ?? true)) headers['x-csrf-token'] = csrfToken;
    if (this.cookies.size > 0) {
      headers['cookie'] = [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
    }
    headers['cf-connecting-ip'] = opts.ip ?? `10.${Math.floor(ipAuto / 250) % 250}.${Math.floor(ipAuto / 250 ** 2) % 250}.${(ipAuto++ % 250) + 1}`;
    const ctx = {
      waitUntil: (p: Promise<unknown>) => {
        this.pending.push(p);
      },
    } as unknown as ExecutionContext;
    const res = await app.request(
      path,
      {
        method,
        headers,
        body,
      },
      env,
      ctx,
    );
    // 合并响应 Set-Cookie（幂等：以最新为准，Max-Age=0 删除）
    for (const sc of res.headers.getSetCookie()) {
      const pair = sc.split(';')[0] ?? '';
      const eq = pair.indexOf('=');
      if (eq > 0) {
        const name = pair.slice(0, eq).trim();
        if (/;\s*max-age=0\b/i.test(sc)) this.cookies.delete(name);
        else this.cookies.set(name, pair.slice(eq + 1));
      }
    }
    return res;
  }

  /** 手动注入 Cookie（构造特殊场景用） */
  setRawCookie(name: string, value: string): void {
    this.cookies.set(name, value);
  }

  /** 引导 CSRF Cookie（页面加载等价行为） */
  async bootstrapCsrf(): Promise<void> {
    await this.call('GET', '/api/auth/csrf');
  }

  async register(email = 'user@example.com', password = 'password-123'): Promise<Response> {
    await this.bootstrapCsrf();
    return this.call('POST', '/api/auth/register', {
      body: { email, password, displayName: '测试用户' },
    });
  }

  async login(email = 'user@example.com', password = 'password-123'): Promise<Response> {
    await this.bootstrapCsrf();
    return this.call('POST', '/api/auth/login', { body: { email, password } });
  }

  async json<T>(res: Response): Promise<T> {
    return (await res.json()) as T;
  }
}

/** 直查审计表（flush 后调用） */
export async function auditRows(action?: string): Promise<Record<string, unknown>[]> {
  const sql = action
    ? 'SELECT * FROM audit_events WHERE action = ? ORDER BY created_at, id'
    : 'SELECT * FROM audit_events ORDER BY created_at, id';
  const stmt = env.AUTH_DB.prepare(sql);
  const res = action ? await stmt.bind(action).all() : await stmt.all();
  return (res.results ?? []) as Record<string, unknown>[];
}

/** 清空业务表（每个用例独立状态） */
export async function resetDb(): Promise<void> {
  await env.AUTH_DB.batch([
    env.AUTH_DB.prepare('DELETE FROM audit_events'),
    env.AUTH_DB.prepare('DELETE FROM sessions'),
    env.AUTH_DB.prepare('DELETE FROM github_accounts'),
    env.AUTH_DB.prepare('DELETE FROM user_roles'),
    env.AUTH_DB.prepare('DELETE FROM users'),
    env.AUTH_DB.prepare('DELETE FROM oauth_refresh_tokens'),
    env.AUTH_DB.prepare('DELETE FROM oauth_codes'),
    env.AUTH_DB.prepare('DELETE FROM oauth_consents'),
    env.AUTH_DB.prepare('DELETE FROM oauth_clients'),
  ]);
}
