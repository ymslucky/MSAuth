/** 主题系统（SPEC §3.1.1）：三套配色循环切换，偏好存 localStorage，html[data-theme] 驱动 */

export type ThemeId = 'ultramarine' | 'flower' | 'lighthouse';

export const THEMES: ReadonlyArray<{ id: ThemeId; label: string }> = [
  { id: 'ultramarine', label: '群青' },
  { id: 'flower', label: '花与月' },
  { id: 'lighthouse', label: '灯塔' },
];

const STORAGE_KEY = 'msauth-theme';

/** 读取持久化主题，非法值回落默认群青 */
export function getTheme(): ThemeId {
  const raw = localStorage.getItem(STORAGE_KEY);
  return THEMES.some((t) => t.id === raw) ? (raw as ThemeId) : 'ultramarine';
}

/** 应用主题到 html[data-theme] 并持久化 */
export function applyTheme(id: ThemeId): void {
  document.documentElement.dataset.theme = id;
  localStorage.setItem(STORAGE_KEY, id);
}

/** 应用启动时同步主题（渲染前调用，避免首帧闪变） */
export function initTheme(): void {
  document.documentElement.dataset.theme = getTheme();
}

/** 循环切换：群青 → 花与月 → 灯塔 → 群青 */
export function cycleTheme(id: ThemeId): ThemeId {
  const index = THEMES.findIndex((t) => t.id === id);
  const next = THEMES[(index + 1) % THEMES.length] ?? THEMES.find((t) => t.id !== id);
  return next?.id ?? 'ultramarine';
}
