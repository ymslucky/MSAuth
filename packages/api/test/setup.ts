/**
 * 测试库初始化：导入迁移 SQL（?raw），去注释、按 ; 切分后用 D1.batch 原子应用。
 * 每个测试文件的隔离存储各自执行一次。
 */
import { env } from 'cloudflare:test';
// @ts-expect-error Vite ?raw 资源导入（测试专用，无 vite/client 类型）
import migration0001 from '../migrations/0001_init.sql?raw';
// @ts-expect-error 同上
import migration0002 from '../migrations/0002_oauth.sql?raw';

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
