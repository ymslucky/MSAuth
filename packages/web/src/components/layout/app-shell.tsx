/** 应用壳（SPEC §5.3）：白色悬浮图标侧栏 + 内容区；<md 折叠为顶部条 + 抽屉 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { KeyRound, LogOut, Menu, MonitorSmartphone, UserRound, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { logout } from '../../lib/auth';
import { useSessionStore } from '../../stores/session';
import { Avatar } from '../ui/avatar';
import { RoleBadge } from '../ui/badge';
import { ThemeToggle } from '../ui/theme-toggle';

const NAV = [
  { to: '/account', label: '概览', icon: UserRound, end: true },
  { to: '/account/sessions', label: '会话', icon: MonitorSmartphone, end: false },
  { to: '/account/password', label: '改密码', icon: KeyRound, end: false },
];

function SidebarContent({ onNavigate, iconOnly = false }: { onNavigate?: () => void; iconOnly?: boolean }) {
  const user = useSessionStore((s) => s.user);
  return (
    <>
      <Link
        to="/account"
        className={iconOnly ? 'flex justify-center' : 'flex items-center gap-2.5 px-2'}
        onClick={onNavigate}
        aria-label="MSAuth 首页"
      >
        {/* 品牌「M + 验证点」字标（SPEC §3.2 v1.2.5，渐变随主题） */}
        <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
          <defs>
            <linearGradient id="msauth-brand-nav" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" style={{ stopColor: 'var(--color-logo-from)' }} />
              <stop offset="1" style={{ stopColor: 'var(--color-logo-to)' }} />
            </linearGradient>
          </defs>
          <rect width="32" height="32" rx="8" fill="url(#msauth-brand-nav)" />
          <path
            d="M9.5 21.5 V12.5 L16 17 L22.5 12.5 V21.5"
            fill="none"
            stroke="#ffffff"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="16" cy="21.5" r="2" fill="#ffffff" />
        </svg>
        {!iconOnly && <span className="font-display text-lg font-bold tracking-tight text-ink">MSAuth</span>}
      </Link>

      <nav className={iconOnly ? 'mt-8 flex flex-col items-center gap-2.5' : 'mt-8 flex flex-col gap-1.5'} aria-label="账户导航">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            aria-label={item.label}
            title={item.label}
            className={({ isActive }) =>
              iconOnly
                ? `flex h-12 w-12 items-center justify-center rounded-full ${
                    isActive
                      ? 'bg-action-subtle text-action-hover'
                      : 'text-ink-3 m3-state hover:text-ink'
                  }`
                : `flex items-center gap-2.5 rounded-full px-4 py-2.5 text-sm font-medium ${
                    isActive
                      ? 'bg-action-subtle text-action-hover'
                      : 'text-ink-3 m3-state hover:text-ink'
                  }`
            }
          >
            <item.icon size={20} strokeWidth={1.75} aria-hidden="true" />
            {!iconOnly && item.label}
          </NavLink>
        ))}
      </nav>

      <div className={`mt-auto flex flex-col gap-2.5 ${iconOnly ? 'items-center' : ''}`}>
        <Avatar name={user?.displayName ?? '?'} size={40} />
        {!iconOnly && (
          <div className="w-full min-w-0 text-center">
            <div className="truncate text-sm leading-5 font-semibold text-ink">{user?.displayName ?? '—'}</div>
            <div className="truncate font-mono text-[11px] text-ink-3">{user?.email}</div>
          </div>
        )}
        <div className={`flex flex-wrap gap-1 ${iconOnly ? 'justify-center' : 'justify-center px-1'}`}>
          {user?.roles.map((role) => (
            <RoleBadge key={role} role={role} />
          ))}
        </div>
      </div>
    </>
  );
}

export function AppShell({ children }: { children?: ReactNode }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const clear = useSessionStore((s) => s.clear);

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      clear();
      void queryClient.clear();
      navigate('/login', { replace: true });
    },
  });

  const logoutBtn = (iconOnly: boolean) => (
    <button
      type="button"
      aria-label="退出登录"
      title="退出登录"
      disabled={logoutMutation.isPending}
      onClick={() => logoutMutation.mutate()}
      className={`flex items-center justify-center rounded-full text-ink-3 m3-state-danger hover:text-danger disabled:opacity-40 ${
        iconOnly ? 'h-12 w-12' : 'h-11 w-full gap-2 text-sm font-medium'
      }`}
    >
      <LogOut size={18} strokeWidth={1.75} aria-hidden="true" />
      {!iconOnly && '退出登录'}
    </button>
  );

  return (
    <div className="min-h-dvh">
      <div className="flex min-h-dvh w-full gap-5 p-3 md:p-5">
        {/* 桌面悬浮图标侧栏 */}
        <aside className="card z-[10] sticky top-5 hidden h-[calc(100dvh-40px)] w-[88px] shrink-0 flex-col items-center rounded-card py-5 md:flex">
          <SidebarContent iconOnly />
          <div className="mt-3 flex flex-col items-center gap-1">
            <ThemeToggle iconOnly />
            {logoutBtn(true)}
          </div>
        </aside>

        {/* 移动端顶栏 + 抽屉 */}
        <div className="card-float fixed inset-x-3 top-3 z-[100] flex items-center justify-between rounded-full px-3 py-2 md:hidden">
          <button
            type="button"
            aria-label={drawerOpen ? '关闭菜单' : '打开菜单'}
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen((v) => !v)}
            className="flex h-11 w-11 items-center justify-center rounded-full text-ink-2 m3-state"
          >
            {drawerOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <span className="font-display font-bold text-ink">MSAuth</span>
          <button
            type="button"
            aria-label="退出登录"
            disabled={logoutMutation.isPending}
            onClick={() => logoutMutation.mutate()}
            className="flex h-11 w-11 items-center justify-center rounded-full text-ink-3 m3-state-danger hover:text-danger disabled:opacity-40"
          >
            <LogOut size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
        {drawerOpen && (
          <div className="fixed inset-0 z-[100] md:hidden" role="dialog" aria-modal="true" aria-label="导航菜单">
            <div className="absolute inset-0 bg-ink/30" onClick={() => setDrawerOpen(false)} />
            <div className="anim-pop card-float absolute inset-y-0 left-0 flex w-64 flex-col gap-4 rounded-none border-y-0 border-l-0 p-4 pt-16">
              <SidebarContent onNavigate={() => setDrawerOpen(false)} />
              <ThemeToggle />
              {logoutBtn(false)}
            </div>
          </div>
        )}

        {/* 内容区 */}
        <main className="min-w-0 flex-1 pt-16 pb-8 md:pt-4 md:pb-4">
          <div className="w-full">{children ?? <Outlet />}</div>
        </main>
      </div>
    </div>
  );
}
