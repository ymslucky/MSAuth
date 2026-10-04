/** 应用壳（SPEC §5.2）：玻璃侧栏 + 内容区；<md 折叠为顶部条 + 抽屉 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { KeyRound, LogOut, Menu, MonitorSmartphone, UserRound, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { logout } from '../../lib/auth';
import { useSessionStore } from '../../stores/session';
import { Avatar } from '../ui/avatar';
import { RoleBadge } from '../ui/badge';
import { Button } from '../ui/button';

const NAV = [
  { to: '/account', label: '概览', icon: UserRound, end: true },
  { to: '/account/sessions', label: '会话', icon: MonitorSmartphone, end: false },
  { to: '/account/password', label: '改密码', icon: KeyRound, end: false },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const user = useSessionStore((s) => s.user);
  return (
    <>
      <Link to="/account" className="flex items-center gap-2.5 px-2" onClick={onNavigate}>
        <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
          <rect width="32" height="32" rx="9" fill="#ffffff" fillOpacity="0.7" stroke="#2c8a58" strokeOpacity="0.25" />
          <path d="M16 6.5l8.5 9.5-8.5 9.5L7.5 16z" fill="none" stroke="#2c8a58" strokeWidth="2.2" />
          <circle cx="16" cy="16" r="2.6" fill="#2c8a58" />
        </svg>
        <span className="font-display text-lg font-bold tracking-tight text-ink">MSAuth</span>
      </Link>

      <nav className="mt-6 flex flex-col gap-1" aria-label="账户导航">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-[140ms] ${
                isActive ? 'bg-leaf-50 text-leaf-700' : 'text-ink-3 hover:bg-leaf-50/50 hover:text-ink'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute top-2 bottom-2 left-0 w-[3px] rounded-full bg-leaf-600" aria-hidden="true" />
                )}
                <item.icon size={18} strokeWidth={1.75} aria-hidden="true" />
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-2.5">
        <div className="flex items-center gap-2.5 rounded-xl border border-line bg-white/50 p-3">
          <Avatar name={user?.displayName ?? '?'} size={36} />
          <div className="min-w-0">
            <div className="truncate text-sm leading-5 font-semibold text-ink">{user?.displayName ?? '—'}</div>
            <div className="truncate font-mono text-[11px] text-ink-3">{user?.email}</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-1 px-1">
          {user?.roles.map((role) => (
            <RoleBadge key={role} role={role} />
          ))}
        </div>
      </div>
    </>
  );
}

export function AppShell({ children }: { children?: ReactNode }) {
  const clear = useSessionStore((s) => s.clear);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      clear();
      void queryClient.clear();
      navigate('/login', { replace: true });
    },
  });

  return (
    <div className="ambient min-h-dvh">
      <div className="mx-auto flex min-h-dvh w-full max-w-6xl">
        {/* 桌面侧栏 */}
        <aside className="glass-1 z-[10] sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-4 rounded-none border-y-0 border-l-0 p-4 md:flex lg:w-64">
          <SidebarContent />
          <Button variant="quiet" size="sm" loading={logoutMutation.isPending} onClick={() => logoutMutation.mutate()}>
            <LogOut size={16} strokeWidth={1.75} aria-hidden="true" />
            退出登录
          </Button>
        </aside>

        {/* 移动端顶栏 + 抽屉 */}
        <div className="fixed inset-x-0 top-0 z-[100] flex items-center justify-between border-b border-line bg-canvas/80 px-4 py-2.5 backdrop-blur-md md:hidden">
          <button
            type="button"
            aria-label={drawerOpen ? '关闭菜单' : '打开菜单'}
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen((v) => !v)}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-ink-2"
          >
            {drawerOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <span className="font-display font-bold text-ink">MSAuth</span>
          <Button variant="quiet" size="sm" loading={logoutMutation.isPending} onClick={() => logoutMutation.mutate()}>
            退出
          </Button>
        </div>
        {drawerOpen && (
          <div className="fixed inset-0 z-[100] md:hidden" role="dialog" aria-modal="true" aria-label="导航菜单">
            <div className="absolute inset-0 bg-canvas/40 backdrop-blur-[2px]" onClick={() => setDrawerOpen(false)} />
            <div className="anim-pop glass-2 absolute inset-y-0 left-0 flex w-64 flex-col gap-4 rounded-none border-y-0 border-l-0 p-4 pt-16">
              <SidebarContent onNavigate={() => setDrawerOpen(false)} />
            </div>
          </div>
        )}

        {/* 内容区 */}
        <main className="flex-1 px-4 pt-16 pb-10 md:px-10 md:py-10">
          <div className="mx-auto max-w-2xl space-y-6">{children ?? <Outlet />}</div>
        </main>
      </div>
    </div>
  );
}
