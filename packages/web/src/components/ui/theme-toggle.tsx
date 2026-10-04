/** 主题切换按钮（SPEC §3.1.1）：点击在 群青 → 花与月 → 灯塔 间循环 */
import { Palette } from 'lucide-react';
import { useState } from 'react';
import { applyTheme, cycleTheme, getTheme, THEMES, type ThemeId } from '../../lib/theme';

export function ThemeToggle({ iconOnly = false }: { iconOnly?: boolean }) {
  const [theme, setTheme] = useState<ThemeId>(() => getTheme());
  const label = THEMES.find((t) => t.id === theme)?.label ?? theme;

  const onClick = () => {
    const next = cycleTheme(theme);
    setTheme(next);
    applyTheme(next);
  };

  if (iconOnly) {
    return (
      <button
        type="button"
        aria-label={`主题：${label}，点击切换`}
        title={`主题：${label}（点击切换）`}
        onClick={onClick}
        className="flex h-12 w-12 items-center justify-center rounded-xl text-ink-3 transition-colors duration-[140ms] hover:bg-canvas hover:text-ink"
      >
        <Palette size={20} strokeWidth={1.75} aria-hidden="true" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-11 w-full items-center gap-2.5 rounded-xl px-3 text-sm font-medium text-ink-3 transition-colors duration-[140ms] hover:bg-canvas hover:text-ink"
    >
      <Palette size={18} strokeWidth={1.75} aria-hidden="true" />
      主题 · {label}
    </button>
  );
}
