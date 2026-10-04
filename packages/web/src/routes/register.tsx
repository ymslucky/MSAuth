/** 注册页 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { registerSchema, type RegisterInput } from '@msauth/shared';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { AuthLayout } from '../components/layout/auth-layout';
import { Alert } from '../components/ui/alert';
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
          <Link to="/login" className="text-brass-300 hover:text-brass-400 hover:underline">
            直接登录
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))} noValidate>
        {formError && <Alert tone="error">{formError}</Alert>}

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
          placeholder="you@example.com"
          error={form.formState.errors.email?.message}
          {...form.register('email')}
        />
        <Field
          label="密码"
          type="password"
          autoComplete="new-password"
          placeholder="至少 10 个字符"
          hint="只要求长度 ≥ 10，无复杂度要求"
          error={form.formState.errors.password?.message}
          {...form.register('password')}
        />

        <Button type="submit" className="w-full" loading={mutation.isPending}>
          创建账户
        </Button>
      </form>
    </AuthLayout>
  );
}
