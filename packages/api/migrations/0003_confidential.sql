-- MSAuth Phase 2b：机密客户端（confidential client，client_credentials 授权模式）
-- 机密客户端持有 client_secret，令牌端点必须完成客户端认证（Basic / POST）；
-- secret 本体不落库，只存 SHA-256 hex，与授权码 / 刷新令牌同一约定

ALTER TABLE oauth_clients ADD COLUMN client_type TEXT NOT NULL DEFAULT 'public';  -- 'public' | 'confidential'
ALTER TABLE oauth_clients ADD COLUMN client_secret_hash TEXT;  -- confidential 专有；public 恒为 NULL
