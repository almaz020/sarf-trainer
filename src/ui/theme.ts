export type Theme = 'auto' | 'light' | 'dark';

export const THEMES: Theme[] = ['auto', 'light', 'dark'];

// «Авто»: атрибута нет, тема по настройкам системы (prefers-color-scheme).
export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement): void {
  if (theme === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}
