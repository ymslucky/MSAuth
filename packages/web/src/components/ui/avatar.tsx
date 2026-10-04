/** 头像（SPEC §6.3）：显示名首字白字 + 名字哈希 → 群青/李子/赤陶/青碧/黛蓝渐变（哑光 accent） */
const GRADIENTS = [
  'from-[#8296ec] to-[#3b5bdb]', // ultramarine
  'from-[#b18ae0] to-[#7048a8]', // plum
  'from-[#e8a06b] to-[#c05c21]', // terracotta
  'from-[#5fc4b6] to-[#0f766e]', // teal
  'from-[#8e9ec9] to-[#47548f]', // slate-blue
];

function hashIndex(name: string, mod: number): number {
  let sum = 0;
  for (const ch of name) sum = (sum + ch.charCodeAt(0)) % 997;
  return sum % mod;
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const grad = GRADIENTS[hashIndex(name, GRADIENTS.length)]!;
  return (
    <div
      aria-hidden="true"
      style={{ width: size, height: size }}
      className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${grad} font-display font-semibold text-white`}
    >
      <span style={{ fontSize: size * 0.4 }}>{name.trim().charAt(0).toUpperCase() || '?'}</span>
    </div>
  );
}
