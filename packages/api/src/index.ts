/**
 * Worker 入口：安全响应头 + requestId、会话/CSRF 中间件、/api/* 路由、healthz、SPA fallback。
 * 单 Worker 同时托管 API 与静态资源（wrangler.toml [assets]，run_worker_first = true）。
 */
import { Hono } from 'hono';
import { accountRoutes } from './routes/account';
import { authRoutes } from './routes/auth';
import type { AppEnv } from './env';
import { csrfGuard } from './middleware/csrf';
import { registerErrorHandler } from './middleware/error';
import { sessionMiddleware } from './middleware/session';
import { ulid } from './lib/ulid';

const app = new Hono<AppEnv>();

registerErrorHandler(app);

/** requestId + 安全响应头（assets 响应同样经过这里） */
app.use('*', async (c, next) => {
  const requestId = ulid();
  c.set('requestId', requestId);
  await next();
  c.header('X-Request-Id', requestId);
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('Referrer-Policy', 'no-referrer');
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  // 无 unsafe-inline：Vite 产物均为外链 script/style（Tailwind v4 外链 CSS）
  c.header(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self'",
      "img-src 'self' https://avatars.githubusercontent.com data:",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  );
  if (new URL(c.req.url).protocol === 'https:') {
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
});

app.use('/api/*', sessionMiddleware());
app.use('/api/*', csrfGuard());

app.route('/api/auth', authRoutes);
app.route('/api/account', accountRoutes);

app.get('/healthz', (c) => c.json({ ok: true }));

// SPA fallback：其余 GET 交给 Workers Assets（not_found_handling = single-page-application）
app.get('*', async (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
