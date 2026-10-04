/** 认证/账户 schema 边界测试 */
import { describe, expect, it } from 'vitest';
import { loginSchema, registerSchema } from '../src/schemas/auth';
import { changePasswordSchema } from '../src/schemas/account';

describe('loginSchema', () => {
  it('邮箱规范化：去空白 + 转小写', () => {
    const parsed = loginSchema.parse({ email: '  Alice@Example.COM ', password: 'x' });
    expect(parsed.email).toBe('alice@example.com');
  });

  it('拒绝非法邮箱', () => {
    expect(() => loginSchema.parse({ email: 'not-an-email', password: 'x' })).toThrow();
  });

  it('拒绝未知字段（strict）', () => {
    expect(() => loginSchema.parse({ email: 'a@b.co', password: 'x', extra: true })).toThrow();
  });

  it('登录密码不做强度校验（避免泄露密码策略）', () => {
    expect(loginSchema.parse({ email: 'a@b.co', password: 'x' }).password).toBe('x');
  });

  it('密码缺失时报错', () => {
    expect(() => loginSchema.parse({ email: 'a@b.co' })).toThrow();
  });
});

describe('registerSchema', () => {
  const valid = { email: 'alice@example.com', password: '0123456789', displayName: '  Alice  ' };

  it('显示名 trim', () => {
    expect(registerSchema.parse(valid).displayName).toBe('Alice');
  });

  it('密码过短被拒', () => {
    expect(() => registerSchema.parse({ ...valid, password: 'short' })).toThrow();
  });

  it('密码超长被拒', () => {
    expect(() => registerSchema.parse({ ...valid, password: 'x'.repeat(129) })).toThrow();
  });

  it('显示名空白被拒', () => {
    expect(() => registerSchema.parse({ ...valid, displayName: '   ' })).toThrow();
  });

  it('拒绝未知字段', () => {
    expect(() => registerSchema.parse({ ...valid, role: 'admin' })).toThrow();
  });
});

describe('changePasswordSchema', () => {
  it('当前密码允许为空串（GitHub-only 用户首次设置密码）', () => {
    const parsed = changePasswordSchema.parse({ currentPassword: '', newPassword: '0123456789' });
    expect(parsed.currentPassword).toBe('');
  });

  it('新密码必须满足密码策略', () => {
    expect(() => changePasswordSchema.parse({ currentPassword: 'old-old-old', newPassword: 'short' })).toThrow();
  });

  it('拒绝未知字段', () => {
    expect(() => changePasswordSchema.parse({ currentPassword: 'x', newPassword: '0123456789', logout: true })).toThrow();
  });
});
