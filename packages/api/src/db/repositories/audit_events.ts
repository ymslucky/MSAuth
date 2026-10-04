/** 审计写入仓储（只追加，不更新不删除；查询接口 Phase 5 再加） */
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
}
