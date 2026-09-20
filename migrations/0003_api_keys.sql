-- Migration number: 0003 	 2026-09-20T00:00:00.000Z
-- Personal API keys: scoped, revocable, machine-facing credentials.
CREATE TABLE IF NOT EXISTS api_key (
    id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    key_prefix TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    scopes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP,
    expires_at TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_api_key_prefix ON api_key(key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_key_hash ON api_key(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_key_user ON api_key(user_id);