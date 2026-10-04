import { fileURLToPath } from 'node:url';
import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

// wrangler/miniflare 的日志写入 XDG_CONFIG_HOME 下的 .wrangler 目录，
// 重定向到包内避免污染用户目录（沙箱/CI 下写 AppData 会失败）
process.env.XDG_CONFIG_HOME = fileURLToPath(new URL('./.xdg-home', import.meta.url));

/**
 * 在 workerd（miniflare）里跑集成测试：
 * - 通过 wrangler.toml 提供 D1 / KV / 限速 binding 与 assets
 * - miniflare.bindings 覆盖测试专用的 GitHub 凭据与基础 URL
 * - isolatedStorage: false —— 业务用 ctx.waitUntil 异步写审计，与 per-test 存储帧
 *   的弹出时机存在已知冲突；测试文件用 beforeEach resetDb 自行清理，文件间仍相互隔离。
 */
export default defineWorkersConfig({
  test: {
    setupFiles: ['./test/setup.ts'],
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.toml' },
        isolatedStorage: false,
        // 文件间共享同一存储：串行执行 + 每个用例 beforeEach resetDb 保证独立性
        singleWorker: true,
        miniflare: {
          bindings: {
            GITHUB_CLIENT_ID: 'test-client-id',
            GITHUB_CLIENT_SECRET: 'test-secret',
            APP_BASE_URL: 'http://api.test',
          },
        },
      },
    },
  },
});
