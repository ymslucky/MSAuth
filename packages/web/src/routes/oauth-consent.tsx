/** OAuth 授权同意页（独立于 AppShell）：展示授权请求详情，同意发码 / 拒绝回 access_denied */
import { useMutation, useQuery } from '@tanstack/react-query';
import { ShieldAlert } from 'lucide-react';
import { SCOPE_LABELS, type ConsentRequestInfo } from '@msauth/shared';
import { useSearchParams } from 'react-router-dom';
import { AuthLayout } from '../components/layout/auth-layout';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { api, ApiError } from '../lib/api';

export default function OAuthConsentPage() {
  const [searchParams] = useSearchParams();
  const requestId = searchParams.get('request_id') ?? '';

  const query = useQuery({
    queryKey: ['oauth-consent', requestId],
    enabled: requestId !== '',
    retry: false,
    queryFn: async (): Promise<ConsentRequestInfo> => {
      try {
        return await api.get(`/api/oauth/consent/request?request_id=${encodeURIComponent(requestId)}`);
      } catch (err) {
        // 未登录：带当前完整路径回登录页，登录后回到本页继续授权
        if (err instanceof ApiError && err.status === 401) {
          const next = encodeURIComponent(location.pathname + location.search);
          location.assign(`/login?next=${next}`);
        }
        throw err;
      }
    },
  });

  const decide = useMutation({
    mutationFn: (approve: boolean) =>
      api.post<{ redirect_to: string }>('/api/oauth/consent', { request_id: requestId, approve }),
    onSuccess: ({ redirect_to }) => {
      location.href = redirect_to;
    },
  });

  const info = query.data;
  const expired =
    query.isError && query.error instanceof ApiError && query.error.code === 'invalid_request';

  return (
    <AuthLayout
      overline="OAuth 授权请求"
      title={query.isLoading ? '正在加载授权请求…' : expired || !requestId ? '授权请求已过期' : '确认授权'}
    >
      {query.isLoading && (
        <div className="space-y-3" aria-hidden="true">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-full" />
        </div>
      )}

      {(expired || !requestId) && !query.isLoading && (
        <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-danger/25 bg-danger-bg px-3.5 py-3 text-sm text-danger">
          <ShieldAlert size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>授权请求已过期或不存在，请回到发起授权的应用重新操作。</span>
        </div>
      )}

      {query.isError && !expired && requestId !== '' && !query.isLoading && (
        <div role="alert" className="rounded-xl border border-danger/25 bg-danger-bg px-3.5 py-3 text-sm text-danger">
          {(query.error as Error).message}
        </div>
      )}

      {info && (
        <>
          <p className="text-sm leading-6 text-ink-3">
            <span className="font-semibold text-ink">{info.client_name}</span> 请求以你的身份访问以下数据与权限：
          </p>

          <ul className="mt-5 space-y-2.5">
            {info.scope.map((scope) => (
              <li key={scope} className="rounded-xl border border-line bg-canvas/60 px-3.5 py-2.5">
                <Badge tone="blue">{scope}</Badge>
                <p className="mt-1.5 text-sm text-ink-3">{SCOPE_LABELS[scope] ?? scope}</p>
              </li>
            ))}
          </ul>

          <dl className="mt-6 space-y-2 border-t border-line pt-5 text-sm">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="shrink-0 text-ink-4">目标服务</dt>
              <dd className="truncate font-mono text-[12px] text-ink-2" title={info.resource}>{info.resource}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="shrink-0 text-ink-4">完成后返回</dt>
              <dd className="truncate font-mono text-[12px] text-ink-2">{info.redirect_host}</dd>
            </div>
          </dl>

          <div className="mt-7 flex gap-3">
            <Button
              className="flex-1"
              loading={decide.isPending && decide.variables === true}
              disabled={decide.isPending && decide.variables === false}
              onClick={() => decide.mutate(true)}
            >
              同意授权
            </Button>
            <Button
              variant="secondary"
              className="flex-1"
              loading={decide.isPending && decide.variables === false}
              disabled={decide.isPending && decide.variables === true}
              onClick={() => decide.mutate(false)}
            >
              拒绝
            </Button>
          </div>

          <p className="mt-4 text-center text-xs leading-5 text-ink-4">
            同意后将返回 {info.redirect_host}；拒绝会告知对方你取消了本次授权，不会泄露任何数据。
          </p>
        </>
      )}
    </AuthLayout>
  );
}
