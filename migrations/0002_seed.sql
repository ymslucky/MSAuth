-- Idempotent defaults. No sample identities, credentials or grants.
INSERT OR IGNORE INTO platformSetting (key, value) VALUES ('registrationEnabled', 'true');
INSERT OR IGNORE INTO platformSetting (key, value) VALUES ('dcrEnabled', 'true');
