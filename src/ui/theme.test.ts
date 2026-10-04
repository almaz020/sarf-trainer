// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { THEMES, applyTheme } from './theme';

describe('applyTheme', () => {
  it('THEMES', () => expect(THEMES).toEqual(['auto', 'light', 'dark']));
  it('light и dark ставят атрибут, auto снимает', () => {
    const el = document.createElement('div');
    applyTheme('dark', el);
    expect(el.getAttribute('data-theme')).toBe('dark');
    applyTheme('light', el);
    expect(el.getAttribute('data-theme')).toBe('light');
    applyTheme('auto', el);
    expect(el.hasAttribute('data-theme')).toBe(false);
  });
  it('по умолчанию documentElement', () => {
    applyTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    applyTheme('auto');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });
});
