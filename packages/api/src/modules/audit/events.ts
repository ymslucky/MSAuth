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

  /** OAuth 2.1（Phase 2） */
  /** 授权端点校验通过（发码或转同意页） */
  OAUTH_AUTHORIZE: 'oauth.authorize',
  /** 用户同意授权 */
  OAUTH_CONSENT_APPROVE: 'oauth.consent.approve',
  /** 用户拒绝授权 */
  OAUTH_CONSENT_DENY: 'oauth.consent.deny',
  /** 兑换授权码签发令牌 */
  OAUTH_TOKEN_ISSUE: 'oauth.token.issue',
  /** 刷新令牌轮换成功 */
  OAUTH_TOKEN_REFRESH: 'oauth.token.refresh',
  /** 刷新令牌重用（整链撤销） */
  OAUTH_TOKEN_REUSE: 'oauth.token.reuse',
  /** 授权码二次使用（重放） */
  OAUTH_CODE_REUSE: 'oauth.code.reuse',
  /** 管理员注册客户端 */
  OAUTH_CLIENT_CREATE: 'oauth.client.create',
  /** 管理员删除客户端 */
  OAUTH_CLIENT_DELETE: 'oauth.client.delete',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];
