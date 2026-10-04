/** D1 轻封装。约定：所有 SQL 只出现在 repositories，路由不得直接写 SQL。 */
import type { Env } from '../env';

export class Db {
  constructor(private readonly d1: D1Database) {}

  prepare(sql: string): D1PreparedStatement {
    return this.d1.prepare(sql);
  }

  async one<T = Record<string, unknown>>(sql: string, ...params: unknown[]): Promise<T | null> {
    return (await this.d1.prepare(sql).bind(...(params as unknown[])).first<T>()) ?? null;
  }

  async all<T = Record<string, unknown>>(sql: string, ...params: unknown[]): Promise<T[]> {
    const result = await this.d1.prepare(sql).bind(...(params as unknown[])).all<T>();
    return result.results ?? [];
  }

  async run(sql: string, ...params: unknown[]): Promise<D1Result> {
    return this.d1.prepare(sql).bind(...(params as unknown[])).run();
  }

  /** D1 无交互式事务，batch 为原子序列 */
  async batch(statements: D1PreparedStatement[]): Promise<D1Result[]> {
    return this.d1.batch(statements);
  }
}

export function dbOf(env: Pick<Env, 'AUTH_DB'>): Db {
  return new Db(env.AUTH_DB);
}
