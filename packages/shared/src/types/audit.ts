/** 审计领域类型 */

export type ActorType = 'user' | 'client' | 'agent' | 'system';

export type AuditResult = 'success' | 'failure' | 'denied';

/** 审计事件（与 audit_events 表一一对应） */
export interface AuditEvent {
  /** ULID */
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
  /** JSON 字符串（写入前由调用方序列化） */
  metadata: string | null;
  requestId: string | null;
}
