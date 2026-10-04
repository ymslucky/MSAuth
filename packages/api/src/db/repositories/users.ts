/** 用户仓储：users / user_roles / github_accounts */
import { type PublicUser, type Role, DEFAULT_NEW_USER_ROLE } from '@msauth/shared';
import type { Db } from '../client';

/** 内部用户行（含敏感字段，仅服务端使用，不得直接返回给客户端） */
export interface InternalUser {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string | null;
  createdAt: number;
  updatedAt: number;
  lastLoginAt: number | null;
}

interface UserRow {
  id: string;
  email: string;
  display_name: string;
  password_hash: string | null;
  created_at: number;
  updated_at: number;
  last_login_at: number | null;
}

function mapRow(row: UserRow): InternalUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at,
  };
}

const USER_COLUMNS = 'id, email, display_name, password_hash, created_at, updated_at, last_login_at';

export class UsersRepository {
  constructor(private readonly db: Db) {}

  async create(input: { id: string; email: string; displayName: string; passwordHash: string | null }): Promise<void> {
    const now = Date.now();
    await this.db.batch([
      this.db
        .prepare('INSERT INTO users (id, email, display_name, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(input.id, input.email, input.displayName, input.passwordHash, now, now),
      this.db
        .prepare('INSERT INTO user_roles (user_id, role, granted_by, granted_at) VALUES (?, ?, ?, ?)')
        .bind(input.id, DEFAULT_NEW_USER_ROLE, null, now),
    ]);
  }

  async byEmail(email: string): Promise<InternalUser | null> {
    const row = await this.db.one<UserRow>(`SELECT ${USER_COLUMNS} FROM users WHERE email = ?`, email);
    return row ? mapRow(row) : null;
  }

  async byId(id: string): Promise<InternalUser | null> {
    const row = await this.db.one<UserRow>(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`, id);
    return row ? mapRow(row) : null;
  }

  async byGithubId(githubId: string): Promise<InternalUser | null> {
    const row = await this.db.one<UserRow>(
      `SELECT u.${USER_COLUMNS.replaceAll(', ', ', u.')} FROM users u
       JOIN github_accounts g ON g.user_id = u.id
       WHERE g.github_id = ?`,
      githubId,
    );
    return row ? mapRow(row) : null;
  }

  /** 组装对外用户（含角色、GitHub 绑定），用户不存在返回 null */
  async getPublicUser(userId: string): Promise<PublicUser | null> {
    const user = await this.byId(userId);
    if (!user) return null;
    const roles = await this.db.all<{ role: string }>('SELECT role FROM user_roles WHERE user_id = ?', userId);
    const gh = await this.db.one<{ github_id: string; login: string | null }>(
      'SELECT github_id, login FROM github_accounts WHERE user_id = ?',
      userId,
    );
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      roles: roles.map((r) => r.role as Role),
      hasPassword: user.passwordHash !== null,
      github: gh ? { login: gh.login, githubId: gh.github_id } : null,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    };
  }

  async updatePassword(userId: string, passwordHash: string | null): Promise<void> {
    await this.db.run('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', passwordHash, Date.now(), userId);
  }

  async touchLastLogin(userId: string): Promise<void> {
    await this.db.run('UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?', Date.now(), Date.now(), userId);
  }

  async linkGithub(input: { githubId: string; userId: string; login: string | null; email: string | null }): Promise<void> {
    await this.db.run(
      'INSERT INTO github_accounts (github_id, user_id, login, email, created_at) VALUES (?, ?, ?, ?, ?)',
      input.githubId,
      input.userId,
      input.login,
      input.email,
      Date.now(),
    );
  }
}
