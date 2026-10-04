/** Web Crypto 基础原语：随机 token、SHA-256、常数时间比较、base64url。无 Node API。 */

const TE = new TextEncoder();

export function toB64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromB64Url(value: string): Uint8Array {
  const pad = value.length % 4 === 0 ? '' : '='.repeat(4 - (value.length % 4));
  const bin = atob(value.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** 随机 token（base64url，无填充） */
export function randomToken(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return toB64Url(buf);
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', TE.encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** 常数时间字符串比较（长度差异也会以恒定轮数跑完） */
export function timingSafeEqualStr(a: string, b: string): boolean {
  const aB = TE.encode(a);
  const bB = TE.encode(b);
  const len = Math.max(aB.length, bB.length);
  let diff = aB.length === bB.length ? 0 : 1;
  for (let i = 0; i < len; i++) {
    diff |= (aB[i] ?? 0) ^ (bB[i] ?? 0);
  }
  return diff === 0;
}
