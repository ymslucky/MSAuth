// Seed data (roles, permissions, grants).
// Idempotent: re-asserted on every cold start by ensure-schema.ts.
export const SEED_SQL = `
-- Built-in roles -------------------------------------------------------------
INSERT OR IGNORE INTO role (name, description, is_system)
VALUES ('admin', 'Administrator', 1);
INSERT OR IGNORE INTO role (name, description, is_system)
VALUES ('user', 'Regular user', 1);

-- Re-assert the system flag (covers rows that predate the column).
UPDATE role SET is_system = 1 WHERE name IN ('admin', 'user');

-- Permissions ----------------------------------------------------------------
INSERT OR IGNORE INTO permission (code, description) VALUES
    ('users:read', 'View users'),
    ('users:write', 'Manage users'),
    ('users:assign_roles', 'Assign roles to users'),
    ('roles:read', 'View roles'),
    ('roles:write', 'Manage roles'),
    ('permissions:read', 'View permissions'),
    ('permissions:write', 'Manage permissions'),
    ('audit:read', 'View audit log');

-- The admin role holds every permission --------------------------------------
INSERT OR IGNORE INTO role_permission (role_id, permission_id)
SELECT r.id, p.id FROM role r, permission p WHERE r.name = 'admin';
`;
