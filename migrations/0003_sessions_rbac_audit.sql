-- Migration number: 0003 	 2026-09-20T00:00:00.000Z
-- Admin sessions, RBAC hardening and audit log (merged migration; supersedes
-- the previously unpublished 0003/0004/0005 files).

CREATE TABLE IF NOT EXISTS admin_sessions (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE role ADD COLUMN is_system INTEGER NOT NULL DEFAULT 0;
UPDATE role SET is_system = 1 WHERE name IN ('admin', 'user');

CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
    actor_id TEXT NOT NULL,
    actor_email TEXT NOT NULL,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL DEFAULT '',
    detail TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO permission (code, description)
VALUES ('users:assign_roles', 'Assign roles to users');
INSERT OR IGNORE INTO permission (code, description)
VALUES ('audit:read', 'View audit log');

INSERT OR IGNORE INTO role_permission (role_id, permission_id)
SELECT r.id, p.id FROM role r, permission p
WHERE r.name = 'admin' AND p.code IN ('users:assign_roles', 'audit:read');