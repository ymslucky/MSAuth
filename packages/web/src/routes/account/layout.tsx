/** 账户区布局：会话守卫 + 外壳 */
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { AppShell } from '../../components/layout/app-shell';
import { PageSpinner } from '../../components/ui/spinner';
import { useSession } from '../../hooks/use-session';

export default function AccountLayout() {
  const { isLoading, user } = useSession();
  const location = useLocation();

  if (isLoading) return <PageSpinner label="验证会话…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
