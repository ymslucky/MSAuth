/**
 * 审计写入：
 * - audit()：异步（ctx.waitUntil），不阻塞业务；失败仅记日志
 * - auditSync()：同步等待，失败抛出（用于"失败则拒绝业务"的关键操作）
 */
import type { ActorType, AuditResult } from '@msauth/shared';
import type { Context } from 'hono';
import { AuditEventsRepository, dbOf } from '../../db/repositories';
import type { AppEnv } from '../../env';
import { ulid } from '../../lib/ulid';

export interface AuditEntryInput {
  action: string;
  result: AuditResult;
  targetType?: string | null;
  targetId?: string | null;
  reason?: string | null;
  /** 自动 JSON 序列化 */
  metadata?: Record<string, unknown> | null;
  actorId?: string | null;
  actorType?: ActorType;
}

function buildEvent(c: Context<AppEnv>, input: AuditEntryInput) {
  return {
    id: ulid(),
    createdAt: Date.now(),
    actorId: input.actorId ?? c.get('user')?.id ?? null,
    actorType: input.actorType ?? 'user',
    actorIp: c.req.header('CF-Connecting-IP') ?? null,
    actorUa: c.req.header('user-agent') ?? null,
    action: input.action,
    targetType: input.targetType ?? null,
    targetId: input.targetId ?? null,
    result: input.result,
    reason: input.reason ?? null,
    metadata: input.metadata === undefined || input.metadata === null ? null : JSON.stringify(input.metadata),
    requestId: c.get('requestId') ?? null,
  };
}

/** 异步写入（普通业务事件） */
export function audit(c: Context<AppEnv>, input: AuditEntryInput): void {
  const event = buildEvent(c, input);
  c.executionCtx.waitUntil(
    new AuditEventsRepository(dbOf(c.env)).insert(event).catch((err) => {
      console.error(`[msauth] audit write failed: ${input.action}`, err);
    }),
  );
}

/** 同步写入（关键操作：失败即拒绝业务） */
export async function auditSync(c: Context<AppEnv>, input: AuditEntryInput): Promise<void> {
  await new AuditEventsRepository(dbOf(c.env)).insert(buildEvent(c, input));
}
