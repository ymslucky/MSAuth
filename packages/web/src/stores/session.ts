/** 全局会话状态（Zustand）：登录/登出/引导时同步，供非请求上下文读取 */
import type { PublicUser } from '@msauth/shared';
import { create } from 'zustand';

interface SessionState {
  user: PublicUser | null;
  setUser: (user: PublicUser | null) => void;
  clear: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  clear: () => set({ user: null }),
}));
