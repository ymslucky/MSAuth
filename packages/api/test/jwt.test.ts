/** jose 封装单元测试（Phase 2a 起 OAuth 令牌将复用） */
import { describe, expect, it } from 'vitest';
import { signJwt, verifyJwt } from '../src/lib/jwt';

interface KeyPair {
  privateKey: CryptoKey;
  publicKey: CryptoKey;
}

async function ecKeys(): Promise<KeyPair> {
  const pair = (await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign', 'verify'],
  )) as CryptoKeyPair;
  return { privateKey: pair.privateKey, publicKey: pair.publicKey };
}

describe('jwt（jose 封装）', () => {
  it('签发后可验证并还原 claims', async () => {
    const kp = await ecKeys();
    const token = await signJwt({ sub: 'user_1', scope: 'profile:read' }, kp.privateKey, {
      issuer: 'https://auth.test',
      audience: 'mstor',
      expiresIn: 60,
    });
    const payload = await verifyJwt<{ sub: string; scope: string }>(token, kp.publicKey, {
      issuer: 'https://auth.test',
      audience: 'mstor',
    });
    expect(payload?.sub).toBe('user_1');
    expect(payload?.scope).toBe('profile:read');
  });

  it('过期令牌验证返回 null', async () => {
    const kp = await ecKeys();
    const token = await signJwt({ sub: 'u' }, kp.privateKey, { expiresIn: -1 });
    await expect(verifyJwt(token, kp.publicKey)).resolves.toBeNull();
  });

  it('错误密钥验证返回 null', async () => {
    const [a, b] = await Promise.all([ecKeys(), ecKeys()]);
    const token = await signJwt({ sub: 'u' }, a.privateKey, { expiresIn: 60 });
    await expect(verifyJwt(token, b.publicKey)).resolves.toBeNull();
  });

  it('audience 不匹配验证返回 null', async () => {
    const kp = await ecKeys();
    const token = await signJwt({ sub: 'u' }, kp.privateKey, { audience: 'mstor', expiresIn: 60 });
    await expect(verifyJwt(token, kp.publicKey, { audience: 'pve' })).resolves.toBeNull();
  });
});
