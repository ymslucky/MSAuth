/** PBKDF2 密码哈希单元测试 */
import { describe, expect, it } from 'vitest';
import { burnDummyPassword, hashPassword, verifyPassword } from '../src/modules/auth/password';

describe('password（PBKDF2-SHA256 × 100000）', () => {
  it('哈希为自描述格式且可验证', async () => {
    const stored = await hashPassword('correct-horse-battery');
    expect(stored.startsWith('pbkdf2$sha256$100000$')).toBe(true);
    await expect(verifyPassword('correct-horse-battery', stored)).resolves.toBe(true);
  });

  it('错误密码验证失败', async () => {
    const stored = await hashPassword('correct-horse-battery');
    await expect(verifyPassword('wrong-password!!', stored)).resolves.toBe(false);
  });

  it('同一密码两次哈希盐不同（结果不同但都可验证）', async () => {
    const a = await hashPassword('same-password-1');
    const b = await hashPassword('same-password-1');
    expect(a).not.toBe(b);
    await expect(verifyPassword('same-password-1', a)).resolves.toBe(true);
    await expect(verifyPassword('same-password-1', b)).resolves.toBe(true);
  });

  it('篡改/损坏的存储串验证失败而非抛错', async () => {
    await expect(verifyPassword('x', 'not-a-hash')).resolves.toBe(false);
    await expect(verifyPassword('x', 'pbkdf2$sha256$0$abc$def')).resolves.toBe(false);
    await expect(verifyPassword('x', 'pbkdf2$sha256$999999999$abc$def')).resolves.toBe(false);
  });

  it('burnDummyPassword 可执行（登录时序对齐）', async () => {
    await expect(burnDummyPassword()).resolves.toBeUndefined();
  });
});
