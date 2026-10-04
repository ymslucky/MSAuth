/** 改密码（SPEC §7.5）：成功后其他设备登出（当前保留），toast 反馈 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { changePasswordSchema, PASSWORD_POLICY } from '@msauth/shared';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { GlassCard } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Field } from '../../components/ui/input';
import { useToast } from '../../components/ui/toast';
import { useCsrfWarmup } from '../../hooks/use-csrf';
import { ApiError } from '../../lib/api';
import { changePassword } from '../../lib/auth';
import { useSessionStore } from '../../stores/session';

/** 本地表单 schema：共享 schema + 确认密码一致性 */
const passwordFormSchema = changePasswordSchema
  .extend({
    confirmPassword: z
      .string({ message: '请再次输入新密码' })
      .min(1, '请再次输入新密码')
      .max(PASSWORD_POLICY.maxLength, '密码过长'),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    message: '两次输入的新密码不一致',
  });

type PasswordFormValues = z.infer<typeof passwordFormSchema>;

export default function PasswordPage() {
  useCsrfWarmup();
  const toast = useToast();
  const hasPassword = useSessionStore((s) => s.user?.hasPassword) ?? false;

  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });
  const newPassword = form.watch('newPassword');
  const confirmPassword = form.watch('confirmPassword');
  const confirmMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  const mutation = useMutation({
    mutationFn: (values: PasswordFormValues) => changePassword(values.currentPassword, values.newPassword),
    onSuccess: () => {
      toast.success('密码已更新', '其他设备已退出登录，当前设备保持在线。');
      form.reset({ currentPassword: '', newPassword: '', confirmPassword: '' });
    },
  });

  return (
    <div className="stagger space-y-6">
      <div>
        <p className="overline mb-1">PASSWORD · 安全</p>
        <h1 className="t-display">修改密码</h1>
      </div>

      <GlassCard title="设置新密码" desc="修改成功后，除当前设备外的所有会话都会被强制退出。">
        <form className="max-w-md space-y-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))} noValidate>
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
          <Field
            label="确认新密码"
            type="password"
            autoComplete="new-password"
            placeholder="再输入一次新密码"
            error={confirmMismatch ? '两次输入的新密码不一致' : form.formState.errors.confirmPassword?.message}
            {...form.register('confirmPassword')}
          />

          {mutation.isError && (
            <p role="alert" className="t-caption text-danger">
              {mutation.error instanceof ApiError && mutation.error.status === 401 ? '当前密码不正确' : (mutation.error as Error).message}
            </p>
          )}

          <Button type="submit" loading={mutation.isPending}>
            更新密码
          </Button>
        </form>
      </GlassCard>
    </div>
  );
}
