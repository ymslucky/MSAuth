/** 会话管理：列表、撤销单个、撤销其他 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert } from '../../components/ui/alert';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { PageSpinner } from '../../components/ui/spinner';
import { listSessions, revokeOtherSessions, revokeSession, sessionsKey } from '../../lib/auth';
import { fmtDateTime, summarizeUa } from '../../lib/format';

export default function SessionsPage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: sessionsKey, queryFn: listSessions });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: sessionsKey });

  const revokeOne = useMutation({
    mutationFn: revokeSession,
    onSuccess: invalidate,
  });
  const revokeOthers = useMutation({
    mutationFn: revokeOtherSessions,
    onSuccess: invalidate,
  });

  if (query.isLoading) return <PageSpinner label="加载会话…" />;
  if (query.isError) return <Alert tone="error">{(query.error as Error).message}</Alert>;

  const sessions = query.data?.sessions ?? [];
  const hasOthers = sessions.some((s) => !s.current);

  return (
    <>
      <div className="anim-rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="overline mb-1">SESSIONS · 会话</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-paper">登录设备</h1>
        </div>
        <Button
          variant="ghost"
          disabled={!hasOthers}
          loading={revokeOthers.isPending}
          onClick={() => revokeOthers.mutate()}
        >
          撤销其他会话{hasOthers ? '' : '（无）'}
        </Button>
      </div>

      {revokeOthers.isSuccess && revokeOthers.data && (
        <Alert tone="success">已撤销 {revokeOthers.data.revoked} 个其他会话。</Alert>
      )}
      {revokeOne.isError && <Alert tone="error">{(revokeOne.error as Error).message}</Alert>}

      <Card desc="撤销当前会话等同于在本设备登出。">
        <ul className="divide-y divide-ink-700/70">
          {sessions.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm text-paper">{summarizeUa(s.userAgent)}</span>
                  {s.current && <Badge tone="brass">当前设备</Badge>}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 font-mono text-[11px] text-fog-500">
                  <span title={s.id}>{s.id.slice(0, 12)}…</span>
                  {s.ip && <span>{s.ip}</span>}
                  <span>活跃 {fmtDateTime(s.lastSeenAt)}</span>
                  <span>创建 {fmtDateTime(s.createdAt)}</span>
                </div>
              </div>
              <Button
                variant="danger"
                loading={revokeOne.isPending && revokeOne.variables === s.id}
                onClick={() => {
                  if (s.current && !window.confirm('撤销当前会话将退出登录，确定？')) return;
                  revokeOne.mutate(s.id);
                }}
              >
                撤销
              </Button>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
