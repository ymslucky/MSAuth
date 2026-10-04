/**
 * 全局常量：角色、TTL、scope 注册表、OAuth 枚举。
 *
 * 约定：
 * - 本文件只放纯数据与类型推导，不放运行时逻辑，确保 shared 在
 *   Workers / 浏览器任何环境都能直接引用。
 * - 所有 TTL 单位为秒；修改只影响新签发的令牌，不影响存量令牌。
 */

// ===== 角色（MSAuth 侧的粗粒度平台角色；业务角色归下游应用自己管） =====

export const ROLES = ['admin', 'member', 'viewer', 'none'] as const;
export type Role = (typeof ROLES)[number];

/** 角色中文说明（同意页与管理后台展示用） */
export const ROLE_LABELS: Record<Role, string> = {
  admin: '平台管理员：管理用户、客户端、审计日志',
  member: '成员：标准使用者',
  viewer: '只读用户：仅查看授权给自己的内容',
  none: '无角色：仅能登录，无平台权限',
};

/** 新注册用户的默认角色（待确认：也可改为 'none'，注册后由管理员分配） */
export const DEFAULT_NEW_USER_ROLE: Role = 'member';

// ===== 密码策略（只限长度，不做复杂度要求，遵循 NIST SP 800-63B） =====

export const PASSWORD_POLICY = {
  minLength: 10,
  maxLength: 128,
} as const;

// ===== 密码哈希（Web Crypto PBKDF2，仅用 Web Crypto，不用 Node API） =====

export const PBKDF2_PARAMS = {
  /** 迭代次数 */
  iterations: 100_000,
  /** 摘要算法 */
  hash: 'SHA-256',
  /** 盐长度（字节） */
  saltBytes: 16,
  /** 派生密钥长度（字节） */
  keyBytes: 32,
} as const;

// ===== Cookie =====

/**
 * Cookie 名称。session/csrf 均带 __Host- 前缀：
 * 强制 Secure + Path=/ + 不带 Domain，防子域注入。
 */
export const COOKIES = {
  /** 会话 Cookie：HttpOnly，值为 ULID 明文（库中只存 SHA-256 哈希） */
  session: '__Host-msauth_session',
  /** CSRF 双提交 Cookie：非 HttpOnly（SPA 需读取后放入 x-csrf-token 头） */
  csrf: '__Host-msauth_csrf',
} as const;

// ===== 会话 TTL（秒）—— 需求未指定，当前为假设值，可调整 =====

/** 空闲过期：超过该时长没有携带会话的请求即失效 */
export const SESSION_IDLE_TTL = 7 * 24 * 60 * 60; // 7 天

/** 绝对过期：自创建起的最长寿命，到期必须重新认证 */
export const SESSION_ABSOLUTE_TTL = 30 * 24 * 60 * 60; // 30 天

// ===== 令牌 TTL（秒）=====

/** 全局默认 TTL；授权码与 Agent 委托令牌为固定值，不可按客户端覆盖 */
export const DEFAULT_TTL = {
  /** 访问令牌：15 分钟 */
  accessToken: 15 * 60,
  /** 刷新令牌：7 天 */
  refreshToken: 7 * 24 * 60 * 60,
  /** 授权码：1 分钟，固定值 */
  authorizationCode: 60,
  /** Agent 委托令牌：5 分钟，固定值（Phase 4） */
  agentDelegationToken: 5 * 60,
} as const;

/**
 * 客户端级 TTL 覆盖的合法区间：
 * oauth_clients.access_token_ttl / refresh_token_ttl 只有落在此区间内才生效。
 */
export const TTL_LIMITS = {
  accessToken: { min: 60, max: 60 * 60 }, // 60 秒 – 1 小时
  refreshToken: { min: 24 * 60 * 60, max: 90 * 24 * 60 * 60 }, // 1 天 – 90 天
} as const;

// ===== scope 注册表 =====

/** key 即 scope 字符串本身；value 是同意页展示给用户的中文说明 */
export const SCOPES = {
  'profile:read': '读取你的基本资料（显示名、邮箱）',
  offline_access: '离线访问：在你不在场时持续访问（签发刷新令牌）',
  'mstor:read': '读取 mstor 中的文件列表与元数据',
  'mstor:write': '在 mstor 中上传、修改、删除文件',
  'mstor:admin': '管理 mstor 的用户与共享设置',
  'pve:read': '查看 PVE 虚拟机与资源状态',
  'pve:write': '操作 PVE 虚拟机（启动、停止、快照）',
  'pve:admin': '管理 PVE 节点与资源分配',
} as const;

export type Scope = keyof typeof SCOPES;

/** 全部合法 scope（授权端点校验 + 管理后台展示） */
export const SCOPE_LIST = Object.keys(SCOPES) as Scope[];

/**
 * scope → 中文标签（同意页徽标展示）。
 * 与 SCOPES 的说明共用一份文案，键覆盖 SCOPE_LIST 全量。
 */
export const SCOPE_LABELS: Record<string, string> = { ...SCOPES };

// ===== 角色 × scope 矩阵 =====

/**
 * 角色 → 可授权 scope 上限。授权端点取「用户最高角色」的集合，与客户端
 * allowed_scopes、请求 scope 三方求交集得到实际授予的 scope。
 *
 * SCOPES 注册表未内置角色语义，此处按资源动作等级人工划分：
 * - admin：全量（平台管理员可信）
 * - member：读写（排除各资源的 :admin 管理动作）
 * - viewer：只读（:read）+ offline_access（只读应用同样需要刷新令牌）
 * - none：空集（仅能登录，不能授权任何下游资源）
 */
export const ROLE_SCOPES: Record<Role, string[]> = {
  admin: [...SCOPE_LIST],
  member: SCOPE_LIST.filter((s) => !s.endsWith(':admin')),
  viewer: SCOPE_LIST.filter((s) => s.endsWith(':read') || s === 'offline_access'),
  none: [],
};

// ===== OAuth 客户端 / 授权类型 =====

export const CLIENT_TYPES = ['public', 'confidential'] as const;
export type ClientType = (typeof CLIENT_TYPES)[number];

/** OAuth 2.1 只允许 authorization code flow */
export const RESPONSE_TYPES = ['code'] as const;

/** OAuth 2.1 禁止 plain，PKCE 一律 S256 */
export const CODE_CHALLENGE_METHODS = ['S256'] as const;

export const GRANT_TYPES = [
  'authorization_code',
  'refresh_token',
  'client_credentials',
  'urn:ietf:params:oauth:grant-type:token-exchange', // Phase 4
] as const;
export type GrantType = (typeof GRANT_TYPES)[number];

/** /oauth/token 支持的客户端认证方式（公共客户端为 none，靠 PKCE） */
export const TOKEN_ENDPOINT_AUTH_METHODS = [
  'none',
  'client_secret_basic',
  'client_secret_post',
] as const;

// ===== 资源服务器 =====

/** JWT aud 的合法取值（下游资源服务器标识）。注意：aud 绝不能等于 MSAuth 自身 baseURL */
export const RESOURCE_SERVERS = ['mstor', 'pve'] as const;
export type ResourceServer = (typeof RESOURCE_SERVERS)[number];

// ===== Agent 委托（Phase 4） =====

/** 委托链最大深度（含首次签发） */
export const AGENT_DELEGATION_MAX_DEPTH = 4;
