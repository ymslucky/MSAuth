/** OAuth 2.1 仓储：客户端、同意、授权码、刷新令牌（令牌/授权码只存 SHA-256 hex） */
import type { OAuthClient } from '@msauth/shared';
import type { Db } from '../client';

// ===== oauth_clients =====

interface ClientRow {
  id: string;
  name: string;
  client_type: string;
  client_secret_hash: string | null;
  redirect_uris: string;
  allowed_scopes: string;
  resource: string;
  access_token_ttl_seconds: number;
  refresh_token_ttl_seconds: number;
  created_by: string | null;
  created_at: number;
  updated_at: number;
}

function mapClient(row: ClientRow): OAuthClient {
  return {
    id: row.id,
    name: row.name,
    clientType: row.client_type === 'confidential' ? 'confidential' : 'public',
    redirectUris: JSON.parse(row.redirect_uris) as string[],
    allowedScopes: JSON.parse(row.allowed_scopes) as string[],
    resource: row.resource,
    accessTokenTtlSeconds: row.access_token_ttl_seconds,
    refreshTokenTtlSeconds: row.refresh_token_ttl_seconds,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** 令牌端点客户端认证用记录（含 secret 哈希，仅 API 内部使用，绝不序列化外发） */
export interface ClientAuthRecord extends OAuthClient {
  /** confidential 的 client_secret SHA-256 hex；public 恒为 null */
  clientSecretHash: string | null;
}

export interface ClientInsert {
  id: string;
  name: string;
  clientType: OAuthClient['clientType'];
  /** 仅 confidential 传入；public 传 null */
  clientSecretHash: string | null;
  redirectUris: string[];
  allowedScopes: string[];
  resource: string;
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
  createdBy: string | null;
}

export class OAuthClientsRepository {
  constructor(private readonly db: Db) {}

  async create(input: ClientInsert): Promise<void> {
    const now = Date.now();
    await this.db.run(
      `INSERT INTO oauth_clients
        (id, name, client_type, client_secret_hash, redirect_uris, allowed_scopes, resource,
         access_token_ttl_seconds, refresh_token_ttl_seconds, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      input.id,
      input.name,
      input.clientType,
      input.clientSecretHash,
      JSON.stringify(input.redirectUris),
      JSON.stringify(input.allowedScopes),
      input.resource,
      input.accessTokenTtlSeconds,
      input.refreshTokenTtlSeconds,
      input.createdBy,
      now,
      now,
    );
  }

  async byId(id: string): Promise<OAuthClient | null> {
    const row = await this.db.one<ClientRow>('SELECT * FROM oauth_clients WHERE id = ?', id);
    return row ? mapClient(row) : null;
  }

  /** 令牌端点客户端认证：与 byId 同源，但额外带出 secret 哈希做常数时间比对 */
  async byIdWithSecret(id: string): Promise<ClientAuthRecord | null> {
    const row = await this.db.one<ClientRow>('SELECT * FROM oauth_clients WHERE id = ?', id);
    return row ? { ...mapClient(row), clientSecretHash: row.client_secret_hash } : null;
  }

  /** 轮换机密客户端 secret：整串（含 cs_ 前缀）SHA-256 hex 落库 */
  async updateSecretHash(id: string, clientSecretHash: string): Promise<void> {
    await this.db.run(
      'UPDATE oauth_clients SET client_secret_hash = ?, updated_at = ? WHERE id = ?',
      clientSecretHash,
      Date.now(),
      id,
    );
  }

  async list(): Promise<OAuthClient[]> {
    const rows = await this.db.all<ClientRow>('SELECT * FROM oauth_clients ORDER BY created_at DESC');
    return rows.map(mapClient);
  }

  async remove(id: string): Promise<boolean> {
    const res = await this.db.run('DELETE FROM oauth_clients WHERE id = ?', id);
    return (res.meta.changes ?? 0) > 0;
  }
}

// ===== oauth_consents =====

export class OAuthConsentsRepository {
  constructor(private readonly db: Db) {}

  /** 已授权 scope 并集；未同意过返回 null */
  async find(userId: string, clientId: string): Promise<string[] | null> {
    const row = await this.db.one<{ scope: string }>(
      'SELECT scope FROM oauth_consents WHERE user_id = ? AND client_id = ?',
      userId,
      clientId,
    );
    return row ? (row.scope.split(' ').filter(Boolean)) : null;
  }

  /** upsert：scope 与既有授权取并集（已授权范围只增不减） */
  async upsert(userId: string, clientId: string, scopes: string[]): Promise<void> {
    const existing = await this.find(userId, clientId);
    const merged = [...new Set([...(existing ?? []), ...scopes])];
    const now = Date.now();
    await this.db.run(
      `INSERT INTO oauth_consents (user_id, client_id, scope, granted_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (user_id, client_id) DO UPDATE SET scope = excluded.scope, updated_at = excluded.updated_at`,
      userId,
      clientId,
      merged.join(' '),
      now,
      now,
    );
  }

  async removeByClient(clientId: string): Promise<void> {
    await this.db.run('DELETE FROM oauth_consents WHERE client_id = ?', clientId);
  }
}

// ===== oauth_codes =====

export interface CodeRecord {
  codeHash: string;
  clientId: string;
  userId: string;
  resource: string;
  /** 空格连接 */
  scope: string;
  redirectUri: string;
  codeChallenge: string;
  expiresAt: number;
  consumedAt: number | null;
  createdAt: number;
}

interface CodeRow {
  code_hash: string;
  client_id: string;
  user_id: string;
  resource: string;
  scope: string;
  redirect_uri: string;
  code_challenge: string;
  expires_at: number;
  consumed_at: number | null;
  created_at: number;
}

function mapCode(row: CodeRow): CodeRecord {
  return {
    codeHash: row.code_hash,
    clientId: row.client_id,
    userId: row.user_id,
    resource: row.resource,
    scope: row.scope,
    redirectUri: row.redirect_uri,
    codeChallenge: row.code_challenge,
    expiresAt: row.expires_at,
    consumedAt: row.consumed_at,
    createdAt: row.created_at,
  };
}

export interface CodeInsert {
  codeHash: string;
  clientId: string;
  userId: string;
  resource: string;
  scope: string;
  redirectUri: string;
  codeChallenge: string;
  expiresAt: number;
  createdAt: number;
}

export class OAuthCodesRepository {
  constructor(private readonly db: Db) {}

  async create(input: CodeInsert): Promise<void> {
    await this.db.run(
      `INSERT INTO oauth_codes
        (code_hash, client_id, user_id, resource, scope, redirect_uri, code_challenge, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      input.codeHash,
      input.clientId,
      input.userId,
      input.resource,
      input.scope,
      input.redirectUri,
      input.codeChallenge,
      input.expiresAt,
      input.createdAt,
    );
  }

  async byCodeHash(codeHash: string): Promise<CodeRecord | null> {
    const row = await this.db.one<CodeRow>('SELECT * FROM oauth_codes WHERE code_hash = ?', codeHash);
    return row ? mapCode(row) : null;
  }

  /** 原子消费：仅当未消费时置 consumed_at，返回是否抢到（防并发双重兑换） */
  async consume(codeHash: string, now: number): Promise<boolean> {
    const res = await this.db.run(
      'UPDATE oauth_codes SET consumed_at = ? WHERE code_hash = ? AND consumed_at IS NULL',
      now,
      codeHash,
    );
    return (res.meta.changes ?? 0) === 1;
  }

  async removeByClient(clientId: string): Promise<void> {
    await this.db.run('DELETE FROM oauth_codes WHERE client_id = ?', clientId);
  }
}

// ===== oauth_refresh_tokens =====

export interface RefreshTokenRecord {
  id: string;
  familyId: string;
  tokenHash: string;
  clientId: string;
  userId: string;
  resource: string;
  /** 空格连接 */
  scope: string;
  expiresAt: number;
  createdAt: number;
  rotatedAt: number | null;
  revokedAt: number | null;
}

interface RefreshRow {
  id: string;
  family_id: string;
  token_hash: string;
  client_id: string;
  user_id: string;
  resource: string;
  scope: string;
  expires_at: number;
  created_at: number;
  rotated_at: number | null;
  revoked_at: number | null;
}

function mapRefresh(row: RefreshRow): RefreshTokenRecord {
  return {
    id: row.id,
    familyId: row.family_id,
    tokenHash: row.token_hash,
    clientId: row.client_id,
    userId: row.user_id,
    resource: row.resource,
    scope: row.scope,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    rotatedAt: row.rotated_at,
    revokedAt: row.revoked_at,
  };
}

export interface RefreshTokenInsert {
  id: string;
  familyId: string;
  tokenHash: string;
  clientId: string;
  userId: string;
  resource: string;
  scope: string;
  expiresAt: number;
  createdAt: number;
}

export class OAuthRefreshTokensRepository {
  constructor(private readonly db: Db) {}

  async create(input: RefreshTokenInsert): Promise<void> {
    await this.db.run(
      `INSERT INTO oauth_refresh_tokens
        (id, family_id, token_hash, client_id, user_id, resource, scope, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      input.id,
      input.familyId,
      input.tokenHash,
      input.clientId,
      input.userId,
      input.resource,
      input.scope,
      input.expiresAt,
      input.createdAt,
    );
  }

  async byTokenHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const row = await this.db.one<RefreshRow>(
      'SELECT * FROM oauth_refresh_tokens WHERE token_hash = ?',
      tokenHash,
    );
    return row ? mapRefresh(row) : null;
  }

  /** 原子轮换：仅当未轮换且未撤销时置 rotated_at（否则视为重放） */
  async rotate(id: string, now: number): Promise<boolean> {
    const res = await this.db.run(
      'UPDATE oauth_refresh_tokens SET rotated_at = ? WHERE id = ? AND rotated_at IS NULL AND revoked_at IS NULL',
      now,
      id,
    );
    return (res.meta.changes ?? 0) === 1;
  }

  /** 撤销整条轮换链（重放检测），返回撤销数量 */
  async revokeFamily(familyId: string, now: number): Promise<number> {
    const res = await this.db.run(
      'UPDATE oauth_refresh_tokens SET revoked_at = ? WHERE family_id = ? AND revoked_at IS NULL',
      now,
      familyId,
    );
    return res.meta.changes ?? 0;
  }

  /** 撤销某用户在某客户端下的全部刷新令牌（授权码重放时兜底） */
  async revokeByClientAndUser(clientId: string, userId: string): Promise<number> {
    const res = await this.db.run(
      'UPDATE oauth_refresh_tokens SET revoked_at = ? WHERE client_id = ? AND user_id = ? AND revoked_at IS NULL',
      Date.now(),
      clientId,
      userId,
    );
    return res.meta.changes ?? 0;
  }

  /** 撤销某客户端下的全部刷新令牌（删除客户端时级联） */
  async revokeByClient(clientId: string): Promise<number> {
    const res = await this.db.run(
      'UPDATE oauth_refresh_tokens SET revoked_at = ? WHERE client_id = ? AND revoked_at IS NULL',
      Date.now(),
      clientId,
    );
    return res.meta.changes ?? 0;
  }
}
