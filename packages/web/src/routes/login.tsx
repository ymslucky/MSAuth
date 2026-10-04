/** 登录页（SPEC §7.1） */
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { loginSchema, type LoginInput } from '@msauth/shared';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { AuthLayout } from '../components/layout/auth-layout';
import { Button } from '../components/ui/button';
import { Field } from '../components/ui/input';
import { useCsrfWarmup } from '../hooks/use-csrf';
import { ApiError } from '../lib/api';
import { login } from '../lib/auth';
import { useSessionStore } from '../stores/session';
import { useState, type ReactNode } from 'react';

function GithubIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

/** 卡顶错误条（danger 浅底条） */
function FormBanner({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="mb-4 flex items-start gap-2.5 rounded-xl border border-danger/25 bg-danger-bg px-3.5 py-2.5 text-sm text-danger">
      <AlertTriangle size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

export default function LoginPage() {
  useCsrfWarmup();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const setUser = useSessionStore((s) => s.setUser);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const mutation = useMutation({
    mutationFn: login,
    onSuccess: ({ user }) => {
      setUser(user);
      void queryClient.invalidateQueries();
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from ?? '/account', { replace: true });
    },
  });

  const githubFailed = searchParams.get('error') === 'github_failed';
  const credentialsError =
    mutation.isError && mutation.error instanceof ApiError && mutation.error.status === 401;
  const formError = credentialsError
    ? '邮箱或密码不正确'
    : mutation.isError
      ? (mutation.error as Error).message
      : null;

  return (
    <AuthLayout
      overline="SIGN IN · 登录"
      title="欢迎回来"
      footer={
        <>
          还没有账号？{' '}
          <Link to="/register" className="font-medium text-action hover:text-action-hover hover:underline">
            创建账户
          </Link>
        </>
      }
    >
      <form className="space-y-5" onSubmit={form.handleSubmit((values) => mutation.mutate(values))} noValidate>
        {githubFailed && <FormBanner>GitHub 登录失败或已过期，请重试。</FormBanner>}
        {formError && !githubFailed && <FormBanner>{formError}</FormBanner>}

        <Field
          label="邮箱"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          error={form.formState.errors.email?.message}
          {...form.register('email')}
        />
        <Field
          label="密码"
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          placeholder="••••••••••"
          error={form.formState.errors.password?.message}
          {...form.register('password')}
          rightSlot={
            <button
              type="button"
              aria-label={showPassword ? '隐藏密码' : '显示密码'}
              onClick={() => setShowPassword((v) => !v)}
              className="mr-1.5 flex h-8 w-8 items-center justify-center rounded-lg text-ink-4 hover:text-ink-2"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          }
        />

        <Button type="submit" className="w-full" loading={mutation.isPending}>
          登录
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />
        <span className="overline">或</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <a
        href="/api/auth/github"
        className="inline-flex h-10 w-full items-center justify-center gap-2.5 rounded-full bg-action-subtle text-sm font-medium text-ink m3-tonal-hover"
      >
        <GithubIcon />
        使用 GitHub 登录
      </a>
    </AuthLayout>
  );
}
