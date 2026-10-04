/** 用户领域类型（API 与 SPA 共用） */
import type { Role } from '../constants';

/** 对外暴露的用户信息（不含 password_hash 等内部字段） */
export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  roles: Role[];
  /** 是否设置了密码（GitHub-only 用户为 false） */
  hasPassword: boolean;
  /** 已绑定的 GitHub 账号 */
  github: { login: string | null; githubId: string } | null;
  createdAt: number;
  lastLoginAt: number | null;
}
