// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import html from '../../index.html?raw';

function inlineScripts(): { index: number; body: string }[] {
  const out: { index: number; body: string }[] = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (/\bsrc\s*=/i.test(m[1]) || /type\s*=\s*["']module["']/i.test(m[1])) continue;
    out.push({ index: m.index, body: m[2] });
  }
  return out;
}

function run(): void {
  const scripts = inlineScripts();
  if (scripts.length === 0) throw new Error('inline script not found');
  new Function(scripts[0].body)();
}

const KEY = 'sarf-trainer:v1';
const root = () => document.documentElement;

describe('инлайн-скрипт темы в index.html', () => {
  beforeEach(() => {
    localStorage.clear();
    root().removeAttribute('data-theme');
  });
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    root().removeAttribute('data-theme');
  });

  it('стоит в <head> до модульного скрипта', () => {
    const scripts = inlineScripts();
    expect(scripts.length).toBeGreaterThan(0);
    const headStart = html.indexOf('<head>');
    const headEnd = html.indexOf('</head>');
    const moduleAt = html.search(/<script\b[^>]*type\s*=\s*["']module["']/i);
    expect(moduleAt).toBeGreaterThan(-1);
    expect(scripts[0].index).toBeGreaterThan(headStart);
    expect(scripts[0].index).toBeLessThan(headEnd);
    expect(scripts[0].index).toBeLessThan(moduleAt);
  });

  it('light', () => {
    localStorage.setItem(KEY, JSON.stringify({ theme: 'light' }));
    run();
    expect(root().getAttribute('data-theme')).toBe('light');
  });

  it('dark', () => {
    localStorage.setItem(KEY, JSON.stringify({ theme: 'dark' }));
    run();
    expect(root().getAttribute('data-theme')).toBe('dark');
  });

  it('auto: атрибута нет', () => {
    localStorage.setItem(KEY, JSON.stringify({ theme: 'auto' }));
    run();
    expect(root().hasAttribute('data-theme')).toBe(false);
  });

  it('пустое хранилище: атрибута нет', () => {
    run();
    expect(root().hasAttribute('data-theme')).toBe(false);
  });

  it('повреждённый JSON: не бросает, атрибута нет', () => {
    localStorage.setItem(KEY, '{broken');
    expect(run).not.toThrow();
    expect(root().hasAttribute('data-theme')).toBe(false);
  });

  it('getItem бросает: не бросает, атрибута нет', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(run).not.toThrow();
    expect(root().hasAttribute('data-theme')).toBe(false);
  });

  it.each(['[]', '"x"', '42', 'null'])('корень %s: атрибута нет', (raw) => {
    localStorage.setItem(KEY, raw);
    expect(run).not.toThrow();
    expect(root().hasAttribute('data-theme')).toBe(false);
  });

  it('неверная тема pink: атрибута нет', () => {
    localStorage.setItem(KEY, JSON.stringify({ theme: 'pink' }));
    run();
    expect(root().hasAttribute('data-theme')).toBe(false);
  });

  it('ключ другого имени: атрибута нет', () => {
    localStorage.setItem('other:v1', JSON.stringify({ theme: 'dark' }));
    run();
    expect(root().hasAttribute('data-theme')).toBe(false);
  });
});
