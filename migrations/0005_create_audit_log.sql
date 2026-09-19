-- Migration number: 0005 	 2026-09-19T00:00:00.000Z
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
VALUES ('audit:read', 'View audit log');

INSERT OR IGNORE INTO role_permission (role_id, permission_id)
SELECT r.id, p.id FROM role r, permission p
WHERE r.name = 'admin' AND p.code = 'audit:read';