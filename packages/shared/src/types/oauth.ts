/** OAuth 2.1 领域类型（API 与 SPA 共用） */

/** OAuth 客户端（公共客户端无 secret，字段可安全返回给管理端） */
export interface OAuthClient {
  id: string;
  name: string;
  /** 已注册回调地址（授权时精确匹配） */
  redirectUris: string[];
  /** 允许申请的 scope（⊆ SCOPE_LIST） */
  allowedScopes: string[];
  /** 访问令牌受众（绝对 URL，≠ MSAuth 自身 baseURL） */
  resource: string;
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
  createdBy: string | null;
  createdAt: number;
  updatedAt: number;
}

/** 同意页展示信息（GET /api/oauth/consent/request 响应） */
export interface ConsentRequestInfo {
  client_name: string;
  client_id: string;
  /** 本次实际会授予的 scope（已按角色与客户端配置裁剪） */
  scope: string[];
  /** 回调地址的 host，向用户提示数据将被送往哪里 */
  redirect_host: string;
  resource: string;
}

/** POST /api/oauth/token 成功响应（RFC 6749 §5.1，字段名保持 wire 格式） */
export interface TokenResponse {
  access_token: string;
  token_type: 'Bearer';
  /** 访问令牌寿命（秒） */
  expires_in: number;
  refresh_token: string;
  /** 实际授予的 scope（空格连接） */
  scope: string;
}
