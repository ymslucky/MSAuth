/** 账户概览（SPEC §7.3）：Bento 网格 —— 身份 / 会话统计（Donut）/ 登录方式 / 账户信息 / 快捷操作 */
import { useQuery } from '@tanstack/react-query';
import { Check, Copy, Github, KeyRound } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { ROLE_LABELS } from '@msauth/shared';
import { Link } from 'react-router-dom';
import { Avatar } from '../../components/ui/avatar';
import { Card } from '../../components/ui/card';
import { Donut } from '../../components/ui/donut';
import { useToast } from '../../components/ui/toast';
import { listSessions, sessionsKey } from '../../lib/auth';
import { fmtDateTime } from '../../lib/format';
import { useSessionStore } from '../../stores/session';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line py-3 last:border-0">
      <span className="text-sm text-ink-3">{label}</span>
      <span className="min-w-0 text-right text-sm text-ink">{children}</span>
    </div>
  );
}

/** 复制按钮：成功变 ✓ + toast（可换色用于蓝底身份卡） */
function CopyButton({ value, className = '' }: { value: string; className?: string }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label="复制"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          toast.success('已复制');
          window.setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error('复制失败', '浏览器未授权剪贴板访问');
        }
      }}
      className={`inline-flex h-6 w-6 items-center justify-center rounded-md ${className || 'text-ink-4 hover:text-action'}`}
    >
      {copied ? (
        <Check size={14} strokeWidth={2.5} className="text-success" aria-hidden="true" />
      ) : (
        <Copy size={14} aria-hidden="true" />
      )}
    </button>
  );
}

export default function AccountIndexPage() {
  const user = useSessionStore((s) => s.user);
  // 与会话页共用缓存（同 queryKey），预取会话数供 Donut 可视化
  const sessionsQuery = useQuery({ queryKey: sessionsKey, queryFn: listSessions });
  const sessions = sessionsQuery.data?.sessions ?? [];
  const total = sessions.length;
  const current = sessions.filter((s) => s.current).length;
  const methods = (user?.hasPassword ? 1 : 0) + (user?.github ? 1 : 0);

  if (!user) return null;

  return (
    <div className="stagger space-y-6">
      <div>
        <h1 className="t-display">你好，{user.displayName}</h1>
        <p className="t-caption mt-1">欢迎回到你的身份中心</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* 身份卡：亮蓝渐变（lg 占 2 列） */}
        <section className="rounded-card bg-gradient-to-br from-[#3b82f6] to-[#6366f1] p-6 shadow-card md:col-span-2">
          <div className="flex flex-wrap items-center gap-4">
            <div className="rounded-full ring-[3px] ring-white/40">
              <Avatar name={user.displayName} size={56} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-display text-xl leading-7 font-bold text-white">{user.displayName}</span>
                {user.roles.map((role) => (
                  <span
                    key={role}
                    className="inline-flex items-center rounded-lg border border-white/25 bg-white/15 px-2 py-0.5 font-mono text-[11px] leading-[16px] text-white"
                  >
                    {role}
                  </span>
                ))}
              </div>
              <p className="mt-1 font-mono text-[12.5px] leading-5 text-white/80">{user.email}</p>
              {user.roles[0] && <p className="mt-0.5 text-[12.5px] text-white/70">{ROLE_LABELS[user.roles[0]]}</p>}
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1 border-t border-white/20 pt-3">
            <span className="font-mono text-[12px] text-white/70">{user.id}</span>
            <CopyButton value={user.id} className="text-white/60 hover:text-white" />
          </div>
        </section>

        {/* 活跃会话统计卡：大数字 + Donut（当前设备 1/N） */}
        <Card className="flex flex-col">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="overline">活跃会话</p>
              <p className="t-stat mt-1">{sessionsQuery.isLoading ? '—' : total}</p>
              <p className="t-caption mt-1">
                {sessionsQuery.isLoading ? '加载中…' : `${current} 台当前设备 · 共 ${total} 个会话`}
              </p>
            </div>
            {!sessionsQuery.isLoading && total > 0 && (
              <Donut percent={(current / total) * 100} size={64} stroke={7} label={`当前设备 ${current} / 共 ${total} 个会话`} />
            )}
          </div>
          <Link to="/account/sessions" className="mt-auto pt-4 text-sm font-medium text-action hover:text-action-hover">
            管理会话 →
          </Link>
        </Card>

        {/* 登录方式统计卡 */}
        <Card className="flex flex-col">
          <p className="overline">登录方式</p>
          <p className="t-stat mt-1">{methods}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium ${
                user.hasPassword ? 'bg-action-subtle text-action-hover' : 'bg-canvas text-ink-3'
              }`}
            >
              <KeyRound size={14} strokeWidth={1.75} aria-hidden="true" />
              密码{user.hasPassword ? ' · 已启用' : ' · 未设置'}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium ${
                user.github ? 'bg-action-subtle text-action-hover' : 'bg-canvas text-ink-3'
              }`}
            >
              <Github size={14} strokeWidth={1.75} aria-hidden="true" />
              GitHub{user.github ? ' · 已绑定' : ' · 未绑定'}
            </span>
          </div>
          {!user.github && (
            <p className="t-caption mt-auto pt-4">
              <a href="/api/auth/github" className="text-action hover:underline">
                用 GitHub 登录一次即可自动绑定
              </a>
            </p>
          )}
        </Card>

        {/* 账户信息卡（lg 占 2 列） */}
        <Card title="账户信息" className="lg:col-span-2">
          <Row label="用户 ID">
            <span className="t-data inline-flex items-center">
              {user.id}
              <CopyButton value={user.id} />
            </span>
          </Row>
          <Row label="创建时间">{fmtDateTime(user.createdAt)}</Row>
          <Row label="最近登录">{fmtDateTime(user.lastLoginAt)}</Row>
        </Card>

        {/* 快捷操作卡 */}
        <Card title="快捷操作" className="flex flex-col justify-center">
          <div className="flex flex-col gap-2.5">
            <Link
              to="/account/password"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-line bg-surface text-sm font-medium text-ink-2 transition-colors duration-[140ms] hover:bg-canvas"
            >
              修改密码
            </Link>
            <Link
              to="/account/sessions"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-line bg-surface text-sm font-medium text-ink-2 transition-colors duration-[140ms] hover:bg-canvas"
            >
              管理登录设备
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
