/** 会话管理（SPEC §7.4）：白卡设备行 + Dialog 确认 + toast 反馈 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LogOut, Monitor, Smartphone, Tablet } from 'lucide-react';
import type { SessionListItem } from '@msauth/shared';
import { useState } from 'react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { Skeleton } from '../../components/ui/skeleton';
import { useToast } from '../../components/ui/toast';
import { listSessions, revokeOtherSessions, revokeSession, sessionsKey } from '../../lib/auth';
import { fmtDateTime, summarizeUa } from '../../lib/format';

type PendingAction = { type: 'one'; session: SessionListItem } | { type: 'others'; count: number };

function DeviceIcon({ ua }: { ua: string | null }) {
  if (/iPad|Tablet/i.test(ua ?? '')) return <Tablet size={18} strokeWidth={1.75} aria-hidden="true" />;
  if (/Mobi|Android|iPhone/i.test(ua ?? '')) return <Smartphone size={18} strokeWidth={1.75} aria-hidden="true" />;
  return <Monitor size={18} strokeWidth={1.75} aria-hidden="true" />;
}

export default function SessionsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [pending, setPending] = useState<PendingAction | null>(null);

  const query = useQuery({ queryKey: sessionsKey, queryFn: listSessions });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: sessionsKey });
  const onError = (err: Error) => toast.error('操作失败', err.message);

  const revokeOne = useMutation({
    mutationFn: revokeSession,
    onSuccess: (_data, id) => {
      if (pending?.type === 'one' && pending.session.id === id) {
        toast.success(pending.session.current ? '已退出当前设备' : '会话已撤销');
      } else {
        toast.success('会话已撤销');
      }
      setPending(null);
      invalidate();
    },
    onError,
  });
  const revokeOthers = useMutation({
    mutationFn: revokeOtherSessions,
    onSuccess: ({ revoked }) => {
      toast.success(`已撤销 ${revoked} 个其他会话`);
      setPending(null);
      invalidate();
    },
    onError,
  });

  const sessions = query.data?.sessions ?? [];
  const othersCount = sessions.filter((s) => !s.current).length;

  return (
    <div className="stagger space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="t-display">登录设备</h1>
          <p className="t-caption mt-1">管理当前登录 MSAuth 的所有设备</p>
        </div>
        <Button variant="secondary" disabled={othersCount === 0} onClick={() => setPending({ type: 'others', count: othersCount })}>
          <LogOut size={16} strokeWidth={1.75} aria-hidden="true" />
          撤销其他会话{othersCount === 0 ? '（无）' : ''}
        </Button>
      </div>

      <div className="card rounded-card p-2">
        {query.isLoading ? (
          <div className="space-y-2 p-3" aria-hidden="true">
            {[0, 1].map((i) => (
              <div key={i} className="flex items-center gap-4 p-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-64" />
                </div>
                <Skeleton className="h-8 w-16" />
              </div>
            ))}
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {sessions.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl p-3 transition-colors duration-[140ms] hover:bg-canvas/70">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-action-subtle text-action">
                  <DeviceIcon ua={s.userAgent} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm leading-5 font-semibold text-ink">{summarizeUa(s.userAgent)}</span>
                    {s.current && <Badge tone="blue">当前设备</Badge>}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4">
                    <span className="t-data" title={s.id}>
                      {s.id.slice(0, 12)}…
                    </span>
                    {s.ip && <span className="t-data">{s.ip}</span>}
                    <span className="t-data">活跃 {fmtDateTime(s.lastSeenAt)}</span>
                  </div>
                </div>
                <Button variant="quiet" size="sm" className="text-danger hover:text-danger" onClick={() => setPending({ type: 'one', session: s })}>
                  撤销
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog
        open={pending !== null}
        onClose={() => setPending(null)}
        tone="danger"
        title={pending?.type === 'one' && pending.session.current ? '退出当前设备？' : '撤销这个会话？'}
        description={
          pending?.type === 'one'
            ? pending.session.current
              ? '撤销当前会话后你将立即登出，需要重新登录。'
              : `将撤销 ${summarizeUa(pending.session.userAgent)} 上的登录状态，该设备会被立即踢下线。`
            : pending?.type === 'others'
              ? `将撤销其他 ${pending.count} 个设备的登录状态，当前设备保持在线。`
              : ''
        }
        confirmText={pending?.type === 'one' && pending.session.current ? '退出登录' : '确认撤销'}
        loading={revokeOne.isPending || revokeOthers.isPending}
        onConfirm={() => {
          if (pending?.type === 'one') revokeOne.mutate(pending.session.id);
          else if (pending?.type === 'others') revokeOthers.mutate();
        }}
      />
    </div>
  );
}
