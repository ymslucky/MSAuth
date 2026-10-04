/** 头像（SPEC §6.3）：显示名首字 + 名字哈希 → 绿色系渐变 */
const GRADIENTS = [
  'from-leaf-300 to-leaf-500',
  'from-leaf-500 to-leaf-700',
  'from-[#b9e0c8] to-leaf-300',
  'from-leaf-600 to-[#1d5739]',
  'from-[#d7ecd9] to-leaf-500',
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
