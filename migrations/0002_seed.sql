-- Platform settings only (idempotent). No sample identities, credentials or
-- authorizations. Anonymous dynamic client registration starts CLOSED —
-- operators opt in from Settings (governed by the /api/auth/oauth2/register gate).
INSERT OR IGNORE INTO platformSetting (key, value) VALUES ('registrationEnabled', 'true');
INSERT OR IGNORE INTO platformSetting (key, value) VALUES ('dcrEnabled', 'false');
