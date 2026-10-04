/** 账户概览（SPEC §7.3）：身份 / 登录方式 / 账户信息 三卡 */
import { Check, Copy, Github, KeyRound, Link2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { ROLE_LABELS } from '@msauth/shared';
import { Avatar } from '../../components/ui/avatar';
import { RoleBadge } from '../../components/ui/badge';
import { GlassCard } from '../../components/ui/card';
import { useToast } from '../../components/ui/toast';
import { fmtDateTime } from '../../lib/format';
import { useSessionStore } from '../../stores/session';
import { Link } from 'react-router-dom';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line py-3 last:border-0">
      <span className="text-sm text-ink-3">{label}</span>
      <span className="min-w-0 text-right text-sm text-ink">{children}</span>
    </div>
  );
}

/** 复制按钮：成功变 ✓ + toast */
function CopyButton({ value }: { value: string }) {
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
      className="ml-1.5 inline-flex h-6 w-6 items-center justify-center rounded-md text-ink-4 hover:text-leaf-600"
    >
      {copied ? <Check size={14} strokeWidth={2.5} className="text-leaf-600" aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
    </button>
  );
}

export default function AccountIndexPage() {
  const user = useSessionStore((s) => s.user);
  if (!user) return null;

  return (
    <div className="stagger space-y-6">
      <div>
        <p className="overline mb-1">ACCOUNT · 账户</p>
        <h1 className="t-display">{user.displayName}</h1>
      </div>

      <GlassCard>
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={user.displayName} size={56} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-lg font-semibold text-ink">{user.displayName}</span>
              {user.roles.map((role) => (
                <RoleBadge key={role} role={role} />
              ))}
            </div>
            <p className="t-data mt-1">{user.email}</p>
            {user.roles[0] && <p className="t-caption mt-0.5">{ROLE_LABELS[user.roles[0]]}</p>}
          </div>
        </div>
      </GlassCard>

      <GlassCard title="登录方式" desc="MSAuth 负责认证；业务角色归各应用自己管理。">
        <Row label="密码">
          {user.hasPassword ? (
            <span className="inline-flex items-center gap-1.5 text-leaf-700">
              <KeyRound size={14} aria-hidden="true" /> 已设置
            </span>
          ) : (
            <span className="text-ink-3">未设置 · 仅 GitHub 登录</span>
          )}
        </Row>
        <Row label="GitHub">
          {user.github ? (
            <span className="inline-flex items-center gap-1.5 font-mono text-[12.5px] text-leaf-700">
              <Github size={14} aria-hidden="true" />@{user.github.login ?? user.github.githubId}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-ink-3">
              <Link2 size={14} aria-hidden="true" />
              未绑定 ·
              <a href="/api/auth/github" className="text-leaf-600 hover:underline">
                用 GitHub 登录一次即可自动绑定
              </a>
            </span>
          )}
        </Row>
        <Row label="安全">
          <Link to="/account/sessions" className="text-leaf-600 hover:underline">
            查看与管理登录设备 →
          </Link>
        </Row>
      </GlassCard>

      <GlassCard title="账户信息">
        <Row label="用户 ID">
          <span className="t-data inline-flex items-center">
            {user.id}
            <CopyButton value={user.id} />
          </span>
        </Row>
        <Row label="创建时间">{fmtDateTime(user.createdAt)}</Row>
        <Row label="最近登录">{fmtDateTime(user.lastLoginAt)}</Row>
      </GlassCard>
    </div>
  );
}
