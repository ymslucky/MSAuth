/**
 * 测试库初始化：导入迁移 SQL（?raw），去注释、按 ; 切分后用 D1.batch 原子应用。
 * isolatedStorage: false + singleWorker 下多个测试文件共享同一存储，
 * 本 setup 会随每个文件重复执行——0001/0002 为幂等 DDL（IF NOT EXISTS）可重复；
 * 0003 的 ALTER TABLE 不幂等，先探测列是否已存在再应用。
 */
import { env } from 'cloudflare:test';
// @ts-expect-error Vite ?raw 资源导入（测试专用，无 vite/client 类型）
import migration0001 from '../migrations/0001_init.sql?raw';
// @ts-expect-error 同上
import migration0002 from '../migrations/0002_oauth.sql?raw';
// @ts-expect-error 同上
import migration0003 from '../migrations/0003_confidential.sql?raw';

function statementsOf(sqlText: string): string[] {
  return (sqlText as string)
    .replace(/--.*$/gm, '') // 去行注释
    .split(';')
    .map((s: string) => s.trim())
    .filter((s: string) => s.length > 0);
}

await env.AUTH_DB.batch(
  [...statementsOf(migration0001), ...statementsOf(migration0002)].map((s) => env.AUTH_DB.prepare(s)),
);

const columns = await env.AUTH_DB.prepare("PRAGMA table_info('oauth_clients')").all<{ name: string }>();
if (!(columns.results ?? []).some((col) => col.name === 'client_type')) {
  await env.AUTH_DB.batch(statementsOf(migration0003).map((s) => env.AUTH_DB.prepare(s)));
}
