/** 预热 CSRF Cookie（表单挂载时调用，提交前 token 已就位） */
import { useEffect } from 'react';
import { getCsrfToken } from '../lib/csrf';

export function useCsrfWarmup(): void {
  useEffect(() => {
    void getCsrfToken().catch(() => undefined);
  }, []);
}
