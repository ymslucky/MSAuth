/** 会话查询 Hook：同步 Zustand store，供守卫与展示使用 */
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { fetchSession, sessionKey } from '../lib/auth';
import { useSessionStore } from '../stores/session';

export function useSession() {
  const setUser = useSessionStore((s) => s.setUser);
  const query = useQuery({ queryKey: sessionKey, queryFn: fetchSession });

  useEffect(() => {
    if (query.data !== undefined) setUser(query.data?.user ?? null);
  }, [query.data, setUser]);

  return {
    ...query,
    user: query.data?.user ?? null,
    sessionId: query.data?.sessionId ?? null,
  };
}
