import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api';

/** 4xx 不重试（会话失效/参数错误重试无意义），其余轻量重试一次 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
        return failureCount < 1;
      },
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
    mutations: { retry: false },
  },
});
