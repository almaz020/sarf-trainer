import type { Mode } from './attempt';
import { emptyCounter, type Counter } from './session';
import { THEMES, type Theme } from './theme';

export const STORAGE_KEY = 'sarf-trainer:v1';

export interface Persisted {
  counter: Counter;
  mode: Mode;
  theme: Theme;
}

export const defaultPersisted: Persisted = { counter: emptyCounter, mode: 'vowelled', theme: 'auto' };

export interface Store {
  load(): Persisted;
  save(p: Persisted): void;
  clearProgress(): Persisted;
}

const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;

function parseCounter(v: unknown): Counter {
  if (typeof v === 'object' && v !== null) {
    const { first, second, failed } = v as Record<string, unknown>;
    if (isCount(first) && isCount(second) && isCount(failed)) return { first, second, failed };
  }
  return { ...emptyCounter };
}

function parse(raw: string | null): Persisted {
  if (raw === null) return { ...defaultPersisted, counter: { ...emptyCounter } };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ...defaultPersisted, counter: { ...emptyCounter } };
  }
  const o = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};
  return {
    counter: parseCounter(o.counter),
    mode: o.mode === 'plain' ? 'plain' : 'vowelled',
    theme: THEMES.includes(o.theme as Theme) ? (o.theme as Theme) : 'auto',
  };
}

// Любой сбой хранилища (недоступно, приватный режим, квота) молча игнорируется.
export function createStore(storage?: Pick<Storage, 'getItem' | 'setItem'>): Store {
  const read = (): Persisted => {
    try {
      return parse((storage ?? window.localStorage).getItem(STORAGE_KEY));
    } catch {
      return parse(null);
    }
  };
  const write = (p: Persisted): void => {
    try {
      (storage ?? window.localStorage).setItem(STORAGE_KEY, JSON.stringify(p));
    } catch {
      /* ничего не сохраняем */
    }
  };
  return {
    load: read,
    save: write,
    clearProgress() {
      const next: Persisted = { ...read(), counter: { ...emptyCounter } };
      write(next);
      return next;
    },
  };
}
