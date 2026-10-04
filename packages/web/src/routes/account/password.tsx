/** 改密码：成功后其他设备全部登出（当前保留） */
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { changePasswordSchema, type ChangePasswordInput } from '@msauth/shared';
import { useForm } from 'react-hook-form';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Field } from '../../components/ui/input';
import { useCsrfWarmup } from '../../hooks/use-csrf';
import { ApiError } from '../../lib/api';
import { changePassword } from '../../lib/auth';
import { useSessionStore } from '../../stores/session';

export default function PasswordPage() {
  useCsrfWarmup();
  const hasPassword = useSessionStore((s) => s.user?.hasPassword) ?? false;

  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '' },
  });

  const mutation = useMutation({
    mutationFn: (values: ChangePasswordInput) => changePassword(values.currentPassword, values.newPassword),
    onSuccess: () => form.reset({ currentPassword: '', newPassword: '' }),
  });

  const formError =
    mutation.isError && mutation.error instanceof ApiError && mutation.error.status === 401
      ? '当前密码不正确'
      : mutation.isError
        ? (mutation.error as Error).message
        : null;

  return (
    <>
      <div className="anim-rise">
        <p className="overline mb-1">PASSWORD · 安全</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-paper">修改密码</h1>
      </div>

      <Card desc="修改成功后，除当前设备外的所有会话都会被强制退出。">
        <form className="max-w-md space-y-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))} noValidate>
          {mutation.isSuccess && (
            <Alert tone="success">密码已更新{mutation.data?.revoked ? `，${mutation.data.revoked} 个其他会话已退出` : ''}。</Alert>
          )}
          {formError && <Alert tone="error">{formError}</Alert>}

          <Field
            label="当前密码"
            type="password"
            autoComplete="current-password"
            placeholder={hasPassword ? '输入当前密码' : '未设置过密码，可留空'}
            hint={hasPassword ? undefined : '你的账户由 GitHub 创建，首次设置密码时留空即可'}
            error={form.formState.errors.currentPassword?.message}
            {...form.register('currentPassword')}
          />
          <Field
            label="新密码"
            type="password"
            autoComplete="new-password"
            placeholder="至少 10 个字符"
            error={form.formState.errors.newPassword?.message}
            {...form.register('newPassword')}
          />

          <Button type="submit" loading={mutation.isPending}>
            更新密码
          </Button>
        </form>
      </Card>
    </>
  );
}
