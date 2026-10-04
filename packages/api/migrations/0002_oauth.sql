-- MSAuth Phase 2：OAuth 2.1 公共客户端授权服务器（客户端、同意、授权码、刷新令牌）
-- 时间戳一律用毫秒整数（Date.now()）；令牌本体不落库，只存 SHA-256 hex

CREATE TABLE IF NOT EXISTS oauth_clients (
  id TEXT PRIMARY KEY,               -- 'c_' + base64url(16B 随机)
  name TEXT NOT NULL,
  redirect_uris TEXT NOT NULL,       -- JSON 数组（精确匹配校验）
  allowed_scopes TEXT NOT NULL,      -- JSON 数组（⊆ SCOPE_LIST）
  resource TEXT NOT NULL,            -- 受众（绝对 URL，注册时校验 ≠ APP_BASE_URL）
  access_token_ttl_seconds INTEGER NOT NULL DEFAULT 900,
  refresh_token_ttl_seconds INTEGER NOT NULL DEFAULT 604800,
  created_by TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS oauth_consents (
  user_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  scope TEXT NOT NULL,               -- 空格连接的已授权 scope 并集
  granted_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, client_id)
);

CREATE TABLE IF NOT EXISTS oauth_codes (
  code_hash TEXT PRIMARY KEY,        -- 授权码明文的 SHA-256 hex
  client_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  resource TEXT NOT NULL,
  scope TEXT NOT NULL,               -- 空格连接
  redirect_uri TEXT NOT NULL,
  code_challenge TEXT NOT NULL,      -- PKCE S256
  expires_at INTEGER NOT NULL,       -- 固定 60 秒
  consumed_at INTEGER,               -- 非空 = 已使用（二次使用即重放）
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_oauth_codes_expires ON oauth_codes(expires_at);

CREATE TABLE IF NOT EXISTS oauth_refresh_tokens (
  id TEXT PRIMARY KEY,               -- ULID
  family_id TEXT NOT NULL,           -- 轮换链 id；重用检测时按链整体撤销
  token_hash TEXT NOT NULL UNIQUE,   -- RT 明文的 SHA-256 hex
  client_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  resource TEXT NOT NULL,
  scope TEXT NOT NULL,               -- 空格连接
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  rotated_at INTEGER,                -- 非空 = 已被新一代替换（再次出现即重放）
  revoked_at INTEGER                 -- 非空 = 已撤销
);
CREATE INDEX IF NOT EXISTS idx_oauth_refresh_family ON oauth_refresh_tokens(family_id);
