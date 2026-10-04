/** 头像（SPEC §6.3）：显示名首字白字 + 名字哈希 → 蓝/紫/橙/天蓝/靛蓝渐变（accent primitive） */
const GRADIENTS = [
  'from-[#60a5fa] to-[#2563eb]', // blue
  'from-[#a78bfa] to-[#7c3aed]', // purple
  'from-[#fb923c] to-[#ea580c]', // orange
  'from-[#38bdf8] to-[#0284c7]', // sky
  'from-[#818cf8] to-[#4f46e5]', // indigo
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
