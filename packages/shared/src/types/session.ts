/** 会话领域类型 */

/** 会话记录（id 为库中存储的 id_hash，非 Cookie 明文，可安全返回给所属用户） */
export interface SessionRecord {
  id: string;
  userId: string;
  createdAt: number;
  lastSeenAt: number;
  /** 绝对过期时间（毫秒时间戳），空闲过期由 lastSeenAt + SESSION_IDLE_TTL 计算 */
  expiresAt: number;
  ip: string | null;
  userAgent: string | null;
}

/** 会话列表项：标记是否为当前会话 */
export interface SessionListItem extends SessionRecord {
  current: boolean;
}
