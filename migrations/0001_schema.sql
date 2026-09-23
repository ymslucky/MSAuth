-- Generated from Better Auth plugin schemas. Run npm run db:schema after plugin changes.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS "user" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL UNIQUE,
  "emailVerified" INTEGER NOT NULL,
  "image" TEXT,
  "createdAt" INTEGER NOT NULL,
  "updatedAt" INTEGER NOT NULL,
  "role" TEXT,
  "banned" INTEGER,
  "banReason" TEXT,
  "banExpires" INTEGER,
  "twoFactorEnabled" INTEGER
);

CREATE TABLE IF NOT EXISTS "session" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "expiresAt" INTEGER NOT NULL,
  "token" TEXT NOT NULL UNIQUE,
  "createdAt" INTEGER NOT NULL,
  "updatedAt" INTEGER NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "userId" TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  "impersonatedBy" TEXT,
  "activeOrganizationId" TEXT
);

CREATE INDEX IF NOT EXISTS "session_userId_idx" ON "session" ("userId");

CREATE TABLE IF NOT EXISTS "account" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "accountId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "idToken" TEXT,
  "accessTokenExpiresAt" INTEGER,
  "refreshTokenExpiresAt" INTEGER,
  "scope" TEXT,
  "password" TEXT,
  "createdAt" INTEGER NOT NULL,
  "updatedAt" INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS "account_userId_idx" ON "account" ("userId");

CREATE TABLE IF NOT EXISTS "verification" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "identifier" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expiresAt" INTEGER NOT NULL,
  "createdAt" INTEGER NOT NULL,
  "updatedAt" INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "verification" ("identifier");

CREATE TABLE IF NOT EXISTS "jwks" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "publicKey" TEXT NOT NULL,
  "privateKey" TEXT NOT NULL,
  "createdAt" INTEGER NOT NULL,
  "expiresAt" INTEGER,
  "alg" TEXT,
  "crv" TEXT
);

CREATE TABLE IF NOT EXISTS "passkey" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "name" TEXT,
  "publicKey" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  "credentialID" TEXT NOT NULL,
  "counter" INTEGER NOT NULL,
  "deviceType" TEXT NOT NULL,
  "backedUp" INTEGER NOT NULL,
  "transports" TEXT,
  "createdAt" INTEGER,
  "aaguid" TEXT
);

CREATE INDEX IF NOT EXISTS "passkey_userId_idx" ON "passkey" ("userId");

CREATE INDEX IF NOT EXISTS "passkey_credentialID_idx" ON "passkey" ("credentialID");

CREATE TABLE IF NOT EXISTS "twoFactor" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "secret" TEXT NOT NULL,
  "backupCodes" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  "verified" INTEGER,
  "failedVerificationCount" INTEGER,
  "lockedUntil" INTEGER
);

CREATE INDEX IF NOT EXISTS "twoFactor_secret_idx" ON "twoFactor" ("secret");

CREATE INDEX IF NOT EXISTS "twoFactor_userId_idx" ON "twoFactor" ("userId");

CREATE TABLE IF NOT EXISTS "organization" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL UNIQUE,
  "logo" TEXT,
  "createdAt" INTEGER NOT NULL,
  "metadata" TEXT
);

CREATE TABLE IF NOT EXISTS "member" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "organizationId" TEXT NOT NULL REFERENCES "organization" ("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  "role" TEXT NOT NULL,
  "createdAt" INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS "member_organizationId_idx" ON "member" ("organizationId");

CREATE INDEX IF NOT EXISTS "member_userId_idx" ON "member" ("userId");

CREATE TABLE IF NOT EXISTS "invitation" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "organizationId" TEXT NOT NULL REFERENCES "organization" ("id") ON DELETE CASCADE,
  "email" TEXT NOT NULL,
  "role" TEXT,
  "status" TEXT NOT NULL,
  "expiresAt" INTEGER NOT NULL,
  "createdAt" INTEGER NOT NULL,
  "inviterId" TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "invitation_organizationId_idx" ON "invitation" ("organizationId");

CREATE INDEX IF NOT EXISTS "invitation_email_idx" ON "invitation" ("email");

CREATE TABLE IF NOT EXISTS "apikey" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "configId" TEXT NOT NULL,
  "name" TEXT,
  "start" TEXT,
  "referenceId" TEXT NOT NULL,
  "prefix" TEXT,
  "key" TEXT NOT NULL,
  "refillInterval" INTEGER,
  "refillAmount" INTEGER,
  "lastRefillAt" INTEGER,
  "enabled" INTEGER,
  "rateLimitEnabled" INTEGER,
  "rateLimitTimeWindow" INTEGER,
  "rateLimitMax" INTEGER,
  "requestCount" INTEGER,
  "remaining" INTEGER,
  "lastRequest" INTEGER,
  "expiresAt" INTEGER,
  "createdAt" INTEGER NOT NULL,
  "updatedAt" INTEGER NOT NULL,
  "permissions" TEXT,
  "metadata" TEXT
);

CREATE INDEX IF NOT EXISTS "apikey_configId_idx" ON "apikey" ("configId");

CREATE INDEX IF NOT EXISTS "apikey_referenceId_idx" ON "apikey" ("referenceId");

CREATE INDEX IF NOT EXISTS "apikey_key_idx" ON "apikey" ("key");

CREATE TABLE IF NOT EXISTS "oauthClient" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "clientId" TEXT NOT NULL UNIQUE,
  "clientSecret" TEXT,
  "clientDiscoveryId" TEXT,
  "disabled" INTEGER,
  "skipConsent" INTEGER,
  "enableEndSession" INTEGER,
  "subjectType" TEXT,
  "scopes" TEXT,
  "clientCredentialsScopes" TEXT,
  "userId" TEXT REFERENCES "user" ("id") ON DELETE CASCADE,
  "createdAt" INTEGER,
  "updatedAt" INTEGER,
  "name" TEXT,
  "uri" TEXT,
  "icon" TEXT,
  "contacts" TEXT,
  "tos" TEXT,
  "policy" TEXT,
  "softwareId" TEXT,
  "softwareVersion" TEXT,
  "softwareStatement" TEXT,
  "redirectUris" TEXT NOT NULL,
  "postLogoutRedirectUris" TEXT,
  "backchannelLogoutUri" TEXT,
  "backchannelLogoutSessionRequired" INTEGER,
  "tokenEndpointAuthMethod" TEXT,
  "applicationType" TEXT,
  "jwks" TEXT,
  "jwksUri" TEXT,
  "grantTypes" TEXT,
  "responseTypes" TEXT,
  "requirePKCE" INTEGER,
  "dpopBoundAccessTokens" INTEGER,
  "referenceId" TEXT,
  "metadata" TEXT
);

CREATE INDEX IF NOT EXISTS "oauthClient_userId_idx" ON "oauthClient" ("userId");

CREATE TABLE IF NOT EXISTS "oauthResource" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "identifier" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "accessTokenTtl" INTEGER,
  "refreshTokenTtl" INTEGER,
  "signingAlgorithm" TEXT,
  "signingKeyId" TEXT,
  "allowedScopes" TEXT,
  "customClaims" TEXT,
  "dpopBoundAccessTokensRequired" INTEGER,
  "disabled" INTEGER,
  "createdAt" INTEGER,
  "updatedAt" INTEGER,
  "policyVersion" INTEGER,
  "metadata" TEXT
);

CREATE TABLE IF NOT EXISTS "oauthClientResource" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "clientId" TEXT NOT NULL REFERENCES "oauthClient" ("clientId") ON DELETE CASCADE,
  "resourceId" TEXT NOT NULL REFERENCES "oauthResource" ("identifier") ON DELETE CASCADE,
  "metadata" TEXT,
  "createdAt" INTEGER
);

CREATE INDEX IF NOT EXISTS "oauthClientResource_clientId_idx" ON "oauthClientResource" ("clientId");

CREATE INDEX IF NOT EXISTS "oauthClientResource_resourceId_idx" ON "oauthClientResource" ("resourceId");

CREATE UNIQUE INDEX IF NOT EXISTS "oauthClientResource_clientId_resourceId_uidx" ON "oauthClientResource" ("clientId", "resourceId");

CREATE TABLE IF NOT EXISTS "oauthRefreshToken" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "token" TEXT NOT NULL UNIQUE,
  "clientId" TEXT NOT NULL REFERENCES "oauthClient" ("clientId") ON DELETE CASCADE,
  "sessionId" TEXT REFERENCES "session" ("id") ON DELETE SET NULL,
  "userId" TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  "referenceId" TEXT,
  "authorizationCodeId" TEXT,
  "resources" TEXT,
  "requestedUserInfoClaims" TEXT,
  "expiresAt" INTEGER NOT NULL,
  "createdAt" INTEGER NOT NULL,
  "revoked" INTEGER,
  "rotatedAt" INTEGER,
  "rotationReplayResponse" TEXT,
  "rotationReplayExpiresAt" INTEGER,
  "authTime" INTEGER,
  "confirmation" TEXT,
  "scopes" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "oauthRefreshToken_clientId_idx" ON "oauthRefreshToken" ("clientId");

CREATE INDEX IF NOT EXISTS "oauthRefreshToken_sessionId_idx" ON "oauthRefreshToken" ("sessionId");

CREATE INDEX IF NOT EXISTS "oauthRefreshToken_userId_idx" ON "oauthRefreshToken" ("userId");

CREATE INDEX IF NOT EXISTS "oauthRefreshToken_authorizationCodeId_idx" ON "oauthRefreshToken" ("authorizationCodeId");

CREATE TABLE IF NOT EXISTS "oauthAccessToken" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "token" TEXT NOT NULL UNIQUE,
  "clientId" TEXT NOT NULL REFERENCES "oauthClient" ("clientId") ON DELETE CASCADE,
  "sessionId" TEXT REFERENCES "session" ("id") ON DELETE SET NULL,
  "userId" TEXT REFERENCES "user" ("id") ON DELETE CASCADE,
  "referenceId" TEXT,
  "authorizationCodeId" TEXT,
  "resources" TEXT,
  "requestedUserInfoClaims" TEXT,
  "refreshId" TEXT REFERENCES "oauthRefreshToken" ("id") ON DELETE CASCADE,
  "expiresAt" INTEGER NOT NULL,
  "createdAt" INTEGER NOT NULL,
  "revoked" INTEGER,
  "confirmation" TEXT,
  "scopes" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "oauthAccessToken_clientId_idx" ON "oauthAccessToken" ("clientId");

CREATE INDEX IF NOT EXISTS "oauthAccessToken_sessionId_idx" ON "oauthAccessToken" ("sessionId");

CREATE INDEX IF NOT EXISTS "oauthAccessToken_userId_idx" ON "oauthAccessToken" ("userId");

CREATE INDEX IF NOT EXISTS "oauthAccessToken_authorizationCodeId_idx" ON "oauthAccessToken" ("authorizationCodeId");

CREATE INDEX IF NOT EXISTS "oauthAccessToken_refreshId_idx" ON "oauthAccessToken" ("refreshId");

CREATE TABLE IF NOT EXISTS "oauthConsent" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "clientId" TEXT NOT NULL REFERENCES "oauthClient" ("clientId") ON DELETE CASCADE,
  "userId" TEXT REFERENCES "user" ("id") ON DELETE CASCADE,
  "referenceId" TEXT,
  "resources" TEXT,
  "requestedUserInfoClaims" TEXT,
  "scopes" TEXT NOT NULL,
  "createdAt" INTEGER NOT NULL,
  "updatedAt" INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS "oauthConsent_clientId_idx" ON "oauthConsent" ("clientId");

CREATE INDEX IF NOT EXISTS "oauthConsent_userId_idx" ON "oauthConsent" ("userId");

CREATE TABLE IF NOT EXISTS "oauthClientAssertion" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "expiresAt" INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS "rateLimit" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "key" TEXT NOT NULL UNIQUE,
  "count" INTEGER NOT NULL,
  "lastRequest" INTEGER NOT NULL
);


CREATE TABLE IF NOT EXISTS agent (
  id TEXT PRIMARY KEY NOT NULL,
  ownerId TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  clientId TEXT,
  dpopJkt TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','revoked')),
  createdAt INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS agent_owner_idx ON agent(ownerId);
CREATE UNIQUE INDEX IF NOT EXISTS agent_client_idx ON agent(clientId);
CREATE TABLE IF NOT EXISTS delegation (
  id TEXT PRIMARY KEY NOT NULL,
  ownerId TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  agentId TEXT NOT NULL REFERENCES agent(id) ON DELETE CASCADE,
  parentId TEXT REFERENCES delegation(id) ON DELETE CASCADE,
  resource TEXT NOT NULL,
  scopes TEXT NOT NULL,
  authorizationDetails TEXT NOT NULL,
  expiresAt INTEGER NOT NULL,
  revokedAt INTEGER,
  depth INTEGER NOT NULL CHECK(depth BETWEEN 0 AND 4),
  createdAt INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS delegation_owner_idx ON delegation(ownerId);
CREATE INDEX IF NOT EXISTS delegation_parent_idx ON delegation(parentId);
CREATE TABLE IF NOT EXISTS auditEvent (
  id TEXT PRIMARY KEY NOT NULL,
  actorId TEXT NOT NULL,
  action TEXT NOT NULL,
  resourceType TEXT NOT NULL,
  resourceId TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '{}',
  createdAt INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS audit_actor_time_idx ON auditEvent(actorId, createdAt DESC);
CREATE INDEX IF NOT EXISTS audit_resource_time_idx ON auditEvent(resourceType, resourceId, createdAt DESC);
CREATE TABLE IF NOT EXISTS platformSetting (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS verifiedDomain (
  id TEXT PRIMARY KEY NOT NULL,
  ownerId TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  hostname TEXT UNIQUE NOT NULL,
  challenge TEXT NOT NULL,
  verifiedAt INTEGER,
  createdAt INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS securityAlert (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  detail TEXT NOT NULL,
  acknowledgedAt INTEGER,
  createdAt INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS security_alert_user_idx ON securityAlert(userId, createdAt DESC);

