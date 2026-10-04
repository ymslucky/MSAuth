/**
 * ULID 生成器（26 字符，Crockford Base32，毫秒时间戳前缀 + 80 位随机）。
 * 同一毫秒内单调递增，保证主键有序。只用 Web Crypto。
 */
const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

let lastTime = -1;
let lastRandom: number[] = [];

function encodeTime(time: number): string {
  let out = '';
  let t = time;
  for (let i = 0; i < 10; i++) {
    out = ENCODING.charAt(t % 32) + out;
    t = Math.floor(t / 32);
  }
  return out;
}

function randomValues(): number[] {
  const bytes = new Uint8Array(16); // 16 × 5bit = 80bit
  crypto.getRandomValues(bytes);
  const vals: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      vals.push((buffer >>> (bits - 5)) & 31);
      bits -= 5;
    }
  }
  if (bits > 0) vals.push((buffer << (5 - bits)) & 31);
  return vals.slice(0, 16);
}

/** 同毫秒内在随机部分上 +1，保证有序且不重复 */
function increment(vals: number[]): void {
  for (let i = vals.length - 1; i >= 0; i--) {
    if (vals[i]! < 31) {
      vals[i] = vals[i]! + 1;
      return;
    }
    vals[i] = 0; // 进位
  }
}

export function ulid(timestamp: number = Date.now()): string {
  if (timestamp === lastTime) {
    increment(lastRandom);
  } else {
    lastTime = timestamp;
    lastRandom = randomValues();
  }
  return encodeTime(timestamp) + lastRandom.map((v) => ENCODING.charAt(v)).join('');
}
