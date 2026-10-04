import { describe, expect, it } from 'vitest';
import { createStore, defaultPersisted } from './storage';

const KEY = 'sarf-trainer:v1';
function fake(initial?: string) {
  const m = new Map<string, string>();
  if (initial !== undefined) m.set(KEY, initial);
  return {
    m,
    getItem: (k: string) => (m.has(k) ? (m.get(k) as string) : null),
    setItem: (k: string, v: string) => void m.set(k, v),
  };
}
const good = { counter: { first: 3, second: 2, failed: 1 }, mode: 'plain', theme: 'dark' };

describe('storage', () => {
  it('цикл записи и чтения, один ключ', () => {
    const s = fake();
    const store = createStore(s);
    store.save({ counter: { first: 1, second: 2, failed: 3 }, mode: 'plain', theme: 'light' });
    expect([...s.m.keys()]).toEqual([KEY]);
    expect(createStore(s).load()).toEqual({ counter: { first: 1, second: 2, failed: 3 }, mode: 'plain', theme: 'light' });
  });

  it('пустое хранилище: defaults', () => {
    expect(createStore(fake()).load()).toEqual(defaultPersisted);
    expect(defaultPersisted).toEqual({ counter: { first: 0, second: 0, failed: 0 }, mode: 'vowelled', theme: 'auto' });
  });

  it.each(['{oops', 'null', '[]', '42', '"x"'])('повреждённые данные %s: defaults', (raw) => {
    expect(createStore(fake(raw)).load()).toEqual(defaultPersisted);
  });

  it('неверный counter заменяется целиком, остальное сохраняется', () => {
    for (const bad of ['5', { first: '1', second: 2, failed: 3 }, { first: -1, second: 2, failed: 3 }, { first: 1.5, second: 2, failed: 3 }, { first: 1, second: 2 }]) {
      const r = createStore(fake(JSON.stringify({ ...good, counter: bad }))).load();
      expect(r).toEqual({ counter: defaultPersisted.counter, mode: 'plain', theme: 'dark' });
    }
  });

  it('неверный mode и theme заменяются независимо', () => {
    expect(createStore(fake(JSON.stringify({ ...good, mode: 'x' }))).load()).toEqual({ ...good, mode: 'vowelled' });
    expect(createStore(fake(JSON.stringify({ ...good, theme: 'x' }))).load()).toEqual({ ...good, theme: 'auto' });
    expect(createStore(fake(JSON.stringify({ counter: good.counter, mode: 1, theme: 2 }))).load()).toEqual({
      counter: good.counter,
      mode: 'vowelled',
      theme: 'auto',
    });
  });

  it('посторонние поля игнорируются', () => {
    const r = createStore(fake(JSON.stringify({ ...good, extra: 1, counter: { ...good.counter, z: 9 } }))).load();
    expect(r).toEqual(good);
    expect(Object.keys(r).sort()).toEqual(['counter', 'mode', 'theme']);
    expect(Object.keys(r.counter).sort()).toEqual(['failed', 'first', 'second']);
  });

  it('хранилище бросает исключения: не бросает, defaults', () => {
    const boom = {
      getItem: () => {
        throw new Error('no');
      },
      setItem: () => {
        throw new Error('quota');
      },
    };
    const store = createStore(boom);
    expect(store.load()).toEqual(defaultPersisted);
    expect(() => store.save(defaultPersisted)).not.toThrow();
    expect(() => store.clearProgress()).not.toThrow();
    expect(store.clearProgress()).toEqual(defaultPersisted);
  });

  it('clearProgress обнуляет counter, сохраняет mode и theme и пишет', () => {
    const s = fake(JSON.stringify(good));
    const r = createStore(s).clearProgress();
    expect(r).toEqual({ counter: { first: 0, second: 0, failed: 0 }, mode: 'plain', theme: 'dark' });
    expect(JSON.parse(s.m.get(KEY) as string)).toEqual(r);
  });
});
