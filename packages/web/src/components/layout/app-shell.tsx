/** 应用外壳：侧边导航（概览/会话/改密码）+ 用户区 + 内容出口 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { logout } from '../../lib/auth';
import { useSessionStore } from '../../stores/session';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { BrandMark } from './brand';

const NAV = [
  { to: '/account', label: '概览', end: true },
  { to: '/account/sessions', label: '会话', end: false },
  { to: '/account/password', label: '改密码', end: false },
];

export function AppShell({ children }: { children?: React.ReactNode }) {
  const user = useSessionStore((s) => s.user);
  const clear = useSessionStore((s) => s.clear);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      clear();
      void queryClient.clear();
      navigate('/login', { replace: true });
    },
  });

  return (
    <div className="vault-bg min-h-dvh">
      <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col md:flex-row">
        {/* 侧栏 */}
        <aside className="flex shrink-0 flex-col gap-6 border-b border-ink-700 px-5 py-5 md:w-60 md:border-r md:border-b-0 lg:w-64">
          <Link to="/account" className="flex items-center gap-2.5">
            <BrandMark size={26} />
            <span className="font-display text-lg font-semibold tracking-tight text-paper">MSAuth</span>
          </Link>

          <nav className="flex gap-1.5 md:flex-col" aria-label="账户导航">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? 'border border-brass-400/35 bg-brass-400/10 text-brass-300'
                      : 'border border-transparent text-fog-400 hover:bg-ink-800 hover:text-paper'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="mt-auto hidden gap-2 rounded-xl border border-ink-700 bg-ink-900/70 p-3.5 md:flex md:flex-col">
            <div className="truncate text-sm text-paper">{user?.displayName ?? '—'}</div>
            <div className="truncate font-mono text-[11px] text-fog-500">{user?.email}</div>
            <div className="flex flex-wrap gap-1 pt-1">
              {user?.roles.map((role) => (
                <Badge key={role} tone={role === 'admin' ? 'brass' : 'neutral'}>
                  {role}
                </Badge>
              ))}
            </div>
            <Button
              variant="ghost"
              className="mt-2 w-full"
              loading={logoutMutation.isPending}
              onClick={() => logoutMutation.mutate()}
            >
              退出登录
            </Button>
          </div>
        </aside>

        {/* 内容 */}
        <main className="anim-rise flex-1 px-5 py-8 md:px-10 md:py-10">
          <div className="md:hidden mb-6 flex items-center justify-between">
            <span className="font-mono text-xs text-fog-400">{user?.email}</span>
            <Button variant="quiet" loading={logoutMutation.isPending} onClick={() => logoutMutation.mutate()}>
              退出
            </Button>
          </div>
          <div className="mx-auto max-w-2xl space-y-6">
            {children ?? <Outlet />}
          </div>
        </main>
      </div>
    </div>
  );
}
