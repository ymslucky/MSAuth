/** OAuth 2.1 领域类型（API 与 SPA 共用） */
import type { ClientType } from '../constants';

/**
 * OAuth 客户端（字段可安全返回给管理端；secret 哈希仅存库，绝不进本类型）。
 * public：无 secret，靠 PKCE；confidential：持有 client_secret，需客户端认证。
 */
export interface OAuthClient {
  id: string;
  name: string;
  clientType: ClientType;
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

/**
 * 机密客户端 secret 一次性明文返回（创建 / 轮换时随响应下发）。
 * 库中只存 SHA-256 哈希，明文事后无法找回，只能重新轮换。
 */
export interface ClientSecretCreated {
  /** 客户端 id */
  id: string;
  /** client_secret 明文，仅此一次可见 */
  clientSecret: string;
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
  /** client_credentials 不签发刷新令牌（RFC 6749 §4.4.3），其余模式必返 */
  refresh_token?: string;
  /** 实际授予的 scope（空格连接） */
  scope: string;
}
