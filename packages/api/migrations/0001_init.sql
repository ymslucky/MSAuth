-- MSAuth Phase 1：账号体系（用户、角色、会话、GitHub 绑定、审计）
-- 时间戳一律用毫秒整数（Date.now()）

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,               -- ULID
  email TEXT NOT NULL UNIQUE,        -- 已规范化为小写
  display_name TEXT NOT NULL,
  password_hash TEXT,                -- PBKDF2 自描述格式；GitHub-only 用户为 NULL
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_login_at INTEGER
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,                -- 'admin' | 'member' | 'viewer' | 'none'
  granted_by TEXT,
  granted_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, role)
);

CREATE TABLE IF NOT EXISTS github_accounts (
  github_id TEXT PRIMARY KEY,        -- GitHub 数字 id 的字符串形式
  user_id TEXT NOT NULL UNIQUE,
  login TEXT,
  email TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_github_accounts_user ON github_accounts(user_id);

CREATE TABLE IF NOT EXISTS sessions (
  id_hash TEXT PRIMARY KEY,          -- Cookie 中 ULID 明文的 SHA-256 hex
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,       -- 绝对过期；空闲过期 = now - last_seen_at > 7d
  ip TEXT,
  user_agent TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,               -- ULID
  created_at INTEGER NOT NULL,
  actor_id TEXT,
  actor_type TEXT NOT NULL,          -- 'user' | 'client' | 'agent' | 'system'
  actor_ip TEXT,
  actor_ua TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  result TEXT NOT NULL,              -- 'success' | 'failure' | 'denied'
  reason TEXT,
  metadata TEXT,                     -- JSON 字符串
  request_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_events(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_events(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_target ON audit_events(target_type, target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_events(created_at DESC);
