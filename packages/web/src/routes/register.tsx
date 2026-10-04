/** 注册页（SPEC §7.2） */
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Check } from 'lucide-react';
import { PASSWORD_POLICY, registerSchema, type RegisterInput } from '@msauth/shared';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { AuthLayout } from '../components/layout/auth-layout';
import { Button } from '../components/ui/button';
import { Field } from '../components/ui/input';
import { useCsrfWarmup } from '../hooks/use-csrf';
import { ApiError } from '../lib/api';
import { register } from '../lib/auth';
import { useSessionStore } from '../stores/session';

export default function RegisterPage() {
  useCsrfWarmup();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setUser = useSessionStore((s) => s.setUser);

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: '', password: '', displayName: '' },
  });
  const password = form.watch('password');
  const lengthOk = password.length >= PASSWORD_POLICY.minLength;

  const mutation = useMutation({
    mutationFn: register,
    onSuccess: ({ user }) => {
      setUser(user);
      void queryClient.invalidateQueries();
      navigate('/account', { replace: true });
    },
  });

  const formError =
    mutation.isError && mutation.error instanceof ApiError && mutation.error.code === 'email_already_registered'
      ? '该邮箱已被注册'
      : mutation.isError
        ? (mutation.error as Error).message
        : null;

  return (
    <AuthLayout
      overline="CREATE · 注册"
      title="创建账户"
      footer={
        <>
          已有账户？{' '}
          <Link to="/login" className="font-medium text-action hover:text-action-hover hover:underline">
            直接登录
          </Link>
        </>
      }
    >
      <form className="space-y-5" onSubmit={form.handleSubmit((values) => mutation.mutate(values))} noValidate>
        {formError && (
          <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-danger/25 bg-danger-bg px-3.5 py-2.5 text-sm text-danger">
            <AlertTriangle size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{formError}</span>
          </div>
        )}

        <Field
          label="显示名"
          autoComplete="name"
          placeholder="怎么称呼你"
          error={form.formState.errors.displayName?.message}
          {...form.register('displayName')}
        />
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
          type="password"
          autoComplete="new-password"
          placeholder={`至少 ${PASSWORD_POLICY.minLength} 个字符`}
          error={form.formState.errors.password?.message}
          hint={
            password.length > 0 ? (
              <span className={`inline-flex items-center gap-1 ${lengthOk ? 'text-success' : 'text-ink-3'}`}>
                {lengthOk && <Check size={13} strokeWidth={2.5} aria-hidden="true" />}
                {lengthOk ? '长度满足要求' : `还需 ${PASSWORD_POLICY.minLength - password.length} 个字符`}
              </span>
            ) : undefined
          }
          {...form.register('password')}
        />

        <Button type="submit" className="w-full" loading={mutation.isPending}>
          创建账户
        </Button>
      </form>
    </AuthLayout>
  );
}
