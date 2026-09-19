-- Migration number: 0004 	 2026-09-19T00:00:00.000Z
ALTER TABLE role ADD COLUMN is_system INTEGER NOT NULL DEFAULT 0;

UPDATE role SET is_system = 1 WHERE name IN ('admin', 'user');

INSERT OR IGNORE INTO permission (code, description)
VALUES ('users:assign_roles', 'Assign roles to users');

INSERT OR IGNORE INTO role_permission (role_id, permission_id)
SELECT r.id, p.id FROM role r, permission p
WHERE r.name = 'admin' AND p.code = 'users:assign_roles';