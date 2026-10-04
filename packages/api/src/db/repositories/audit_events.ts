/** 审计事件仓储（只追加；仅提供统计类只读查询，明细查询 Phase 5 再加） */
import type { ActorType, AuditResult } from '@msauth/shared';
import type { Db } from '../client';

export interface AuditInsert {
  id: string;
  createdAt: number;
  actorId: string | null;
  actorType: ActorType;
  actorIp: string | null;
  actorUa: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  result: AuditResult;
  reason: string | null;
  metadata: string | null;
  requestId: string | null;
}

export class AuditEventsRepository {
  constructor(private readonly db: Db) {}

  async insert(event: AuditInsert): Promise<void> {
    await this.db.run(
      `INSERT INTO audit_events
        (id, created_at, actor_id, actor_type, actor_ip, actor_ua, action, target_type, target_id, result, reason, metadata, request_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      event.id,
      event.createdAt,
      event.actorId,
      event.actorType,
      event.actorIp,
      event.actorUa,
      event.action,
      event.targetType,
      event.targetId,
      event.result,
      event.reason,
      event.metadata,
      event.requestId,
    );
  }

  /** 近 N 天当前用户登录统计（按 UTC 日聚合；登录失败事件 actor_id 为空，取 COALESCE(target_id) 归属） */
  async loginDailyStats(
    userId: string,
    sinceMs: number,
  ): Promise<{ date: string; success: number; failure: number }[]> {
    return this.db.all(
      `SELECT date(created_at / 1000, 'unixepoch') AS date,
              SUM(CASE WHEN result = 'success' THEN 1 ELSE 0 END) AS success,
              SUM(CASE WHEN result = 'failure' THEN 1 ELSE 0 END) AS failure
         FROM audit_events
        WHERE action IN ('auth.login', 'auth.login.github')
          AND created_at >= ?
          AND COALESCE(actor_id, target_id) = ?
        GROUP BY date
        ORDER BY date`,
      sinceMs,
      userId,
    );
  }
}
