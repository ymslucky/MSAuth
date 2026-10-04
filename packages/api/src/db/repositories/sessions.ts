/** 会话仓储：id_hash 为主键（Cookie 明文不落库） */
import type { SessionRecord } from '@msauth/shared';
import type { Db } from '../client';

interface SessionRow {
  id_hash: string;
  user_id: string;
  created_at: number;
  last_seen_at: number;
  expires_at: number;
  ip: string | null;
  user_agent: string | null;
}

function mapRow(row: SessionRow): SessionRecord {
  return {
    id: row.id_hash,
    userId: row.user_id,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    expiresAt: row.expires_at,
    ip: row.ip,
    userAgent: row.user_agent,
  };
}

export interface SessionInsert {
  idHash: string;
  userId: string;
  createdAt: number;
  lastSeenAt: number;
  expiresAt: number;
  ip: string | null;
  userAgent: string | null;
}

export class SessionsRepository {
  constructor(private readonly db: Db) {}

  async create(input: SessionInsert): Promise<void> {
    await this.db.run(
      'INSERT INTO sessions (id_hash, user_id, created_at, last_seen_at, expires_at, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)',
      input.idHash,
      input.userId,
      input.createdAt,
      input.lastSeenAt,
      input.expiresAt,
      input.ip,
      input.userAgent,
    );
  }

  async byIdHash(idHash: string): Promise<SessionRecord | null> {
    const row = await this.db.one<SessionRow>('SELECT * FROM sessions WHERE id_hash = ?', idHash);
    return row ? mapRow(row) : null;
  }

  async touch(idHash: string, timestamp: number): Promise<void> {
    await this.db.run('UPDATE sessions SET last_seen_at = ? WHERE id_hash = ?', timestamp, idHash);
  }

  async remove(idHash: string): Promise<boolean> {
    const res = await this.db.run('DELETE FROM sessions WHERE id_hash = ?', idHash);
    return (res.meta.changes ?? 0) > 0;
  }

  async listByUser(userId: string): Promise<SessionRecord[]> {
    const rows = await this.db.all<SessionRow>(
      'SELECT * FROM sessions WHERE user_id = ? ORDER BY last_seen_at DESC',
      userId,
    );
    return rows.map(mapRow);
  }

  /** 撤销除当前外的所有会话，返回撤销数量 */
  async removeOthers(userId: string, keepIdHash: string | null): Promise<number> {
    const res = await this.db.run(
      'DELETE FROM sessions WHERE user_id = ? AND (? IS NULL OR id_hash != ?)',
      userId,
      keepIdHash,
      keepIdHash,
    );
    return res.meta.changes ?? 0;
  }
}
