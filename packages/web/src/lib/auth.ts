/** 认证与账户 API + 会话查询键 */
import type { LoginInput, PublicUser, RegisterInput, SessionListItem } from '@msauth/shared';
import { api, ApiError } from './api';

export interface SessionResponse {
  user: PublicUser;
  sessionId: string;
}

export const sessionKey = ['session'] as const;
export const sessionsKey = ['sessions'] as const;

/** 401 视为未登录（返回 null），其余错误上抛 */
export async function fetchSession(): Promise<SessionResponse | null> {
  try {
    return await api.get<SessionResponse>('/api/auth/session');
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
}

export const login = (input: LoginInput) => api.post<{ user: PublicUser }>('/api/auth/login', input);

export const register = (input: RegisterInput) => api.post<{ user: PublicUser }>('/api/auth/register', input);

export const logout = () => api.post<{ ok: boolean }>('/api/auth/logout');

export const listSessions = () => api.get<{ sessions: SessionListItem[] }>('/api/account/sessions');

export const revokeSession = (id: string) => api.del<{ ok: boolean }>(`/api/account/sessions/${id}`);

export const revokeOtherSessions = () => api.post<{ revoked: number }>('/api/account/sessions/revoke-others');

export const changePassword = (currentPassword: string, newPassword: string) =>
  api.post<{ ok: boolean; revoked: number }>('/api/account/password', { currentPassword, newPassword });
