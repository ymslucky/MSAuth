/** 角色分配仓储（user→role，多对多） */
import { ROLES } from '@msauth/shared';
import type { Db } from '../client';

export class UserRolesRepository {
  constructor(private readonly db: Db) {}

  async assign(userId: string, role: string, grantedBy: string | null): Promise<void> {
    await this.db.run(
      'INSERT OR IGNORE INTO user_roles (user_id, role, granted_by, granted_at) VALUES (?, ?, ?, ?)',
      userId,
      role,
      grantedBy,
      Date.now(),
    );
  }

  async revoke(userId: string, role: string): Promise<void> {
    await this.db.run('DELETE FROM user_roles WHERE user_id = ? AND role = ?', userId, role);
  }

  async forUser(userId: string): Promise<string[]> {
    const rows = await this.db.all<{ role: string }>('SELECT role FROM user_roles WHERE user_id = ?', userId);
    return rows.map((r) => r.role);
  }

  /** 校验 role 合法性（Zod 层之外的双保险） */
  static isValidRole(role: string): boolean {
    return (ROLES as readonly string[]).includes(role);
  }
}
