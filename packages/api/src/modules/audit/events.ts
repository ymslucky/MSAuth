/** 审计动作常量（Phase 1：认证域；后续 Phase 追加 OAuth/Agent/管理域） */
export const AUDIT_ACTIONS = {
  /** 注册 */
  REGISTER: 'auth.register',
  /** 密码登录 */
  LOGIN: 'auth.login',
  /** 登出 */
  LOGOUT: 'auth.logout',
  /** GitHub 登录 */
  LOGIN_GITHUB: 'auth.login.github',
  /** GitHub 账号绑定（邮箱自动绑定） */
  LINK_GITHUB: 'auth.github.link',
  /** 修改密码 */
  PASSWORD_CHANGE: 'auth.password.change',
  /** 撤销单个会话 */
  SESSION_REVOKE: 'auth.session.revoke',
  /** 撤销其他所有会话 */
  SESSION_REVOKE_OTHERS: 'auth.session.revoke_others',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];
