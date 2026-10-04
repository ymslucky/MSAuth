/** 账户概览（SPEC §7.3）：Bento 网格 + 分色系统 + 数据可视化（Donut/Sparkbar） */
import { useQuery } from '@tanstack/react-query';
import { Check, Copy, Github, Info, KeyRound, MonitorSmartphone, TrendingUp, Zap, type LucideIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { ROLE_LABELS } from '@msauth/shared';
import { Link } from 'react-router-dom';
import { Avatar } from '../../components/ui/avatar';
import { Card } from '../../components/ui/card';
import { Donut } from '../../components/ui/donut';
import { Skeleton } from '../../components/ui/skeleton';
import { Sparkbar } from '../../components/ui/sparkbar';
import { useToast } from '../../components/ui/toast';
import { getLoginStats, listSessions, loginStatsKey, sessionsKey } from '../../lib/auth';
import { fmtDateTime } from '../../lib/format';
import { useSessionStore } from '../../stores/session';

/** 图标砖（SPEC §6.3）：tinted 底 + vivid 图标，Bento 分色载体 */
function IconTile({ icon: Icon, className }: { icon: LucideIcon; className: string }) {
  return (
    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${className}`}>
      <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line py-3.5 last:border-0">
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
  // 登录活跃（近 14 天），Sparkbar 数据源
  const statsQuery = useQuery({ queryKey: loginStatsKey, queryFn: getLoginStats });
  const statDays = statsQuery.data?.days ?? [];
  const statSuccess = statDays.reduce((acc, d) => acc + d.success, 0);
  const statFailure = statDays.reduce((acc, d) => acc + d.failure, 0);

  if (!user) return null;

  return (
    <div className="stagger space-y-8">
      <div>
        <h1 className="t-display">你好，{user.displayName}</h1>
        <p className="t-caption mt-1.5">欢迎回到你的身份中心</p>
      </div>

      <div className="grid gap-5 xl:gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {/* 身份卡：单色相深浅渐变（§3.1.1 随主题），xl 占 2 列 */}
        <section className="rounded-card bg-gradient-to-br from-identity-from to-identity-to p-7 shadow-card lg:p-8 md:col-span-2">
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
          <div className="mt-5 flex items-center gap-1 border-t border-white/20 pt-4">
            <span className="font-mono text-[12px] text-white/70">{user.id}</span>
            <CopyButton value={user.id} className="text-white/60 hover:text-white" />
          </div>
        </section>

        {/* 活跃会话：群青 accent + Donut（当前设备 1/N） */}
        <Card className="flex flex-col">
          <div className="flex items-center gap-3">
            <IconTile icon={MonitorSmartphone} className="bg-action-subtle text-action" />
            <p className="overline text-action-hover">活跃会话</p>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <div>
              <p className="t-stat">{sessionsQuery.isLoading ? '—' : total}</p>
              <p className="t-caption mt-1">
                {sessionsQuery.isLoading ? '加载中…' : `${current} 台当前设备在线`}
              </p>
            </div>
            {!sessionsQuery.isLoading && total > 0 && (
              <Donut percent={(current / total) * 100} size={64} stroke={7} label={`当前设备 ${current} / 共 ${total} 个会话`} />
            )}
          </div>
          <Link to="/account/sessions" className="mt-auto pt-5 text-sm font-medium text-action hover:text-action-hover">
            管理会话 →
          </Link>
        </Card>

        {/* 登录方式：plum accent */}
        <Card className="flex flex-col">
          <div className="flex items-center gap-3">
            <IconTile icon={KeyRound} className="bg-accent-purple-bg text-accent-purple-vivid" />
            <p className="overline text-accent-purple">登录方式</p>
          </div>
          <p className="t-stat mt-4">{methods}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium ${
                user.hasPassword ? 'bg-accent-purple-bg text-accent-purple' : 'bg-canvas text-ink-3'
              }`}
            >
              <KeyRound size={14} strokeWidth={1.75} aria-hidden="true" />
              密码{user.hasPassword ? ' · 已启用' : ' · 未设置'}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium ${
                user.github ? 'bg-accent-purple-bg text-accent-purple' : 'bg-canvas text-ink-3'
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

        {/* 账户信息：teal accent（xl 占 2 列） */}
        <Card className="xl:col-span-2">
          <div className="flex items-center gap-3">
            <IconTile icon={Info} className="bg-info-bg text-info-vivid" />
            <div>
              <h2 className="t-title">账户信息</h2>
            </div>
          </div>
          <div className="mt-3">
            <Row label="用户 ID">
              <span className="t-data inline-flex items-center">
                {user.id}
                <CopyButton value={user.id} />
              </span>
            </Row>
            <Row label="创建时间">{fmtDateTime(user.createdAt)}</Row>
            <Row label="最近登录">{fmtDateTime(user.lastLoginAt)}</Row>
          </div>
        </Card>

        {/* 登录活跃：群青 accent + Sparkbar 近 14 天堆叠柱（xl 占 2 列） */}
        <Card className="xl:col-span-2">
          <div className="flex items-center gap-3">
            <IconTile icon={TrendingUp} className="bg-action-subtle text-action" />
            <div>
              <h2 className="t-title">登录活跃</h2>
            </div>
            <span className="t-data ml-auto">近 14 天</span>
          </div>
          <div className="mt-4">
            {statsQuery.isLoading ? (
              <Skeleton className="h-[124px] w-full" aria-hidden="true" />
            ) : (
              <Sparkbar data={statDays} label={`近 14 天登录活跃：成功 ${statSuccess} 次，失败 ${statFailure} 次`} />
            )}
          </div>
          {/* Glance 大数字读数（§6.8 编辑感语法） */}
          <div className="mt-3 flex items-baseline gap-2 border-t border-line pt-3">
            <p className="t-stat">{statSuccess}</p>
            <p className="t-caption">次成功登录</p>
            {statFailure > 0 && <p className="t-caption ml-auto text-danger">失败 {statFailure} 次</p>}
          </div>
        </Card>

        {/* 快捷操作：terracotta accent（xl 占 2 列，宽屏横排） */}
        <Card className="flex flex-col justify-center xl:col-span-2">
          <div className="flex items-center gap-3">
            <IconTile icon={Zap} className="bg-accent-orange-bg text-accent-orange-vivid" />
            <div>
              <h2 className="t-title">快捷操作</h2>
            </div>
          </div>
          <div className="mt-5 flex flex-col gap-3 xl:flex-row">
            <Link
              to="/account/password"
              className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-line bg-surface text-sm font-medium text-ink-2 transition-colors duration-[140ms] hover:bg-canvas"
            >
              <KeyRound size={16} strokeWidth={1.75} className="text-accent-purple-vivid" aria-hidden="true" />
              修改密码
            </Link>
            <Link
              to="/account/sessions"
              className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-line bg-surface text-sm font-medium text-ink-2 transition-colors duration-[140ms] hover:bg-canvas"
            >
              <MonitorSmartphone size={16} strokeWidth={1.75} className="text-action" aria-hidden="true" />
              管理登录设备
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
