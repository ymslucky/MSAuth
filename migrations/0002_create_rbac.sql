-- Migration number: 0002 	 2026-09-19T00:00:00.000Z
CREATE TABLE IF NOT EXISTS role (
    id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
    name TEXT UNIQUE NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS permission (
    id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
    code TEXT UNIQUE NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_role (
    user_id TEXT NOT NULL,
    role_id TEXT NOT NULL,
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS role_permission (
    role_id TEXT NOT NULL,
    permission_id TEXT NOT NULL,
    PRIMARY KEY (role_id, permission_id)
);

INSERT OR IGNORE INTO role (name, description) VALUES ('admin', 'Administrator');
INSERT OR IGNORE INTO role (name, description) VALUES ('user', 'Regular user');

INSERT OR IGNORE INTO permission (code, description) VALUES ('users:read', 'View users');
INSERT OR IGNORE INTO permission (code, description) VALUES ('users:write', 'Manage users and assign roles');
INSERT OR IGNORE INTO permission (code, description) VALUES ('roles:read', 'View roles');
INSERT OR IGNORE INTO permission (code, description) VALUES ('roles:write', 'Manage roles');
INSERT OR IGNORE INTO permission (code, description) VALUES ('permissions:read', 'View permissions');
INSERT OR IGNORE INTO permission (code, description) VALUES ('permissions:write', 'Manage permissions');

INSERT OR IGNORE INTO role_permission (role_id, permission_id)
SELECT r.id, p.id FROM role r, permission p WHERE r.name = 'admin';