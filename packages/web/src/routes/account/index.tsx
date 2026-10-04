/** 账户概览：资料、角色、GitHub 绑定状态、账户元信息 */
import { ROLE_LABELS } from '@msauth/shared';
import { Badge } from '../../components/ui/badge';
import { Card } from '../../components/ui/card';
import { fmtDateTime } from '../../lib/format';
import { useSessionStore } from '../../stores/session';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-ink-700/70 py-3 last:border-0">
      <span className="text-sm text-fog-400">{label}</span>
      <span className="text-sm text-paper">{children}</span>
    </div>
  );
}

export default function AccountIndexPage() {
  const user = useSessionStore((s) => s.user);

  if (!user) return null;

  return (
    <>
      <div className="anim-rise">
        <p className="overline mb-1">ACCOUNT · 账户</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-paper">{user.displayName}</h1>
        <p className="mt-1 font-mono text-sm text-fog-400">{user.email}</p>
      </div>

      <Card title="资料与角色" desc="MSAuth 只管理认证与跨应用粗粒度角色，业务角色归各应用自己管。">
        <Row label="角色">
          <span className="flex flex-wrap gap-1.5">
            {user.roles.map((role) => (
              <Badge key={role} tone={role === 'admin' ? 'brass' : role === 'none' ? 'neutral' : 'moss'}>
                {role}
              </Badge>
            ))}
          </span>
          {user.roles.length > 0 && (
            <span className="ml-2 text-xs text-fog-500">{ROLE_LABELS[user.roles[0]!]}</span>
          )}
        </Row>
        <Row label="密码">
          {user.hasPassword ? <Badge tone="moss">已设置</Badge> : <Badge>未设置 · 仅 GitHub 登录</Badge>}
        </Row>
        <Row label="GitHub">
          {user.github ? (
            <span className="font-mono text-xs text-brass-300">@{user.github.login ?? user.github.githubId}</span>
          ) : (
            <span className="text-xs text-fog-500">
              未绑定 ·{' '}
              <a href="/api/auth/github" className="text-brass-300 hover:underline">
                用 GitHub 登录一次即可自动绑定
              </a>
            </span>
          )}
        </Row>
      </Card>

      <Card title="账户信息" className="anim-rise-2">
        <Row label="用户 ID">
          <span className="font-mono text-xs text-fog-300">{user.id}</span>
        </Row>
        <Row label="创建时间">{fmtDateTime(user.createdAt)}</Row>
        <Row label="最近登录">{fmtDateTime(user.lastLoginAt)}</Row>
      </Card>

      <Card title="安全建议" className="anim-rise-3">
        <ul className="list-disc space-y-2 pl-5 text-sm text-fog-400">
          <li>
            定期在
            <a href="/account/sessions" className="mx-1 text-brass-300 hover:underline">
              会话管理
            </a>
            检查并撤销不再使用的设备。
          </li>
          <li>修改密码会自动退出其他所有设备。</li>
          <li>公共设备上用完记得退出登录。</li>
        </ul>
      </Card>
    </>
  );
}
