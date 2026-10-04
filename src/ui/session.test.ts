import { describe, expect, it } from 'vitest';
import type { PronounId, Verb } from '../engine/paradigm';
import {
  PRONOUN_ORDER,
  addResult,
  currentPronoun,
  emptyCounter,
  nextTask,
  pickVerb,
  selectVerb,
  shufflePronouns,
  startSession,
  type SessionState,
} from './session';

const mk = (id: string): Verb => ({
  id,
  root: ['ن', 'ص', 'ر'],
  midVowel: 'fatha',
  sources: [],
  verified: true,
});
const a = mk('a');
const b = mk('b');
const c = mk('c');

// Детерминированный генератор для проверок «для многих random».
const lcg = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
};
const sorted = (xs: PronounId[]) => [...xs].sort();

describe('PRONOUN_ORDER', () => {
  it('девять id в порядке п. 4 ТЗ (набор для перестановок)', () => {
    expect(PRONOUN_ORDER).toEqual(['hum', 'hiya', 'hunna', 'anta', 'antum', 'anti', 'antunna', 'ana', 'nahnu']);
  });
});

describe('shufflePronouns', () => {
  it('ровно 9 уникальных, равных набору PRONOUN_ORDER', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const p = shufflePronouns(lcg(seed));
      expect(p).toHaveLength(9);
      expect(new Set(p).size).toBe(9);
      expect(sorted(p)).toEqual(sorted(PRONOUN_ORDER));
    }
  });

  it('зависит от random и не мутирует PRONOUN_ORDER', () => {
    const before = [...PRONOUN_ORDER];
    expect(shufflePronouns(() => 0)).not.toEqual(shufflePronouns(() => 0.99));
    expect(PRONOUN_ORDER).toEqual(before);
  });

  it('avoidFirst: первый не равен avoidFirst для многих random', () => {
    for (const id of PRONOUN_ORDER) {
      for (let seed = 1; seed <= 40; seed++) {
        const p = shufflePronouns(lcg(seed), id);
        expect(p[0]).not.toBe(id);
        expect(sorted(p)).toEqual(sorted(PRONOUN_ORDER));
      }
    }
  });

  it('avoidFirst: когда перестановка начинается с него, первый заменяется', () => {
    const plain = shufflePronouns(() => 0);
    const avoided = shufflePronouns(() => 0, plain[0]);
    expect(avoided[0]).not.toBe(plain[0]);
    expect(sorted(avoided)).toEqual(sorted(PRONOUN_ORDER));
    // Если не совпало, перестановка не меняется.
    expect(shufflePronouns(() => 0, plain[8])).toEqual(plain);
  });
});

describe('addResult', () => {
  it('каждый результат увеличивает своё поле на 1', () => {
    expect(addResult(emptyCounter, 'first')).toEqual({ first: 1, second: 0, failed: 0 });
    expect(addResult(emptyCounter, 'second')).toEqual({ first: 0, second: 1, failed: 0 });
    expect(addResult(emptyCounter, 'failed')).toEqual({ first: 0, second: 0, failed: 1 });
  });

  it('не мутирует исходный счётчик', () => {
    const before = { first: 1, second: 2, failed: 3 };
    addResult(before, 'first');
    expect(before).toEqual({ first: 1, second: 2, failed: 3 });
    expect(emptyCounter).toEqual({ first: 0, second: 0, failed: 0 });
  });
});

describe('pickVerb', () => {
  it('без предыдущего выбирает по random из всех', () => {
    expect(pickVerb([a, b, c], null, () => 0)).toBe(a);
    expect(pickVerb([a, b, c], null, () => 0.5)).toBe(b);
    expect(pickVerb([a, b, c], null, () => 0.99)).toBe(c);
  });

  it('никогда не возвращает предыдущий глагол при двух и более глаголах', () => {
    for (let i = 0; i < 100; i++) {
      expect(pickVerb([a, b, c], b, () => i / 100)).not.toBe(b);
      expect(pickVerb([a, b], a, () => i / 100)).toBe(b);
    }
  });

  it('из оставшихся выбирает по random', () => {
    expect(pickVerb([a, b, c], b, () => 0)).toBe(a);
    expect(pickVerb([a, b, c], b, () => 0.99)).toBe(c);
  });

  it('единственный глагол возвращается, даже если он предыдущий', () => {
    expect(pickVerb([a], a, () => 0.7)).toBe(a);
    expect(pickVerb([a], null, () => 0)).toBe(a);
  });

  it('random, равный 1, не выходит за границы', () => {
    expect(pickVerb([a, b, c], null, () => 1)).toBe(c);
    expect(pickVerb([a, b, c], c, () => 1)).toBe(b);
    expect(pickVerb([a], null, () => 1)).toBe(a);
  });
});

function runVerb(start: SessionState, verbs: Verb[], random: () => number) {
  let s = start;
  const seen: PronounId[] = [currentPronoun(s)];
  for (let i = 0; i < 8; i++) {
    s = nextTask(s, verbs, random);
    seen.push(currentPronoun(s));
  }
  return { s, seen };
}

describe('сессия', () => {
  it('startSession: случайный глагол, order — перестановка девяти, index 0, нулевой счётчик', () => {
    const s = startSession([a, b, c], () => 0.99);
    expect(s.verb).toBe(c);
    expect(s.index).toBe(0);
    expect(s.order).toHaveLength(9);
    expect(sorted(s.order)).toEqual(sorted(PRONOUN_ORDER));
    expect(currentPronoun(s)).toBe(s.order[0]);
    expect(s.counter).toEqual(emptyCounter);
  });

  it('startSession: order зависит от random', () => {
    expect(startSession([a, b], () => 0).order).not.toEqual(startSession([a, b], () => 0.99).order);
  });

  it('nextTask внутри глагола не меняет order и идёт по нему, счётчик сохраняется', () => {
    let s = startSession([a, b], lcg(7));
    s = { ...s, counter: { first: 2, second: 1, failed: 4 } };
    const order = s.order;
    const seen = [currentPronoun(s)];
    for (let i = 0; i < 8; i++) {
      s = nextTask(s, [a, b], () => 0);
      seen.push(currentPronoun(s));
      expect(s.order).toBe(order);
      expect(s.index).toBe(i + 1);
    }
    expect(seen).toEqual(order);
    expect(s.counter).toEqual({ first: 2, second: 1, failed: 4 });
  });

  it('за 9 заданий встречаются все 9 местоимений ровно по разу', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { seen } = runVerb(startSession([a, b], lcg(seed)), [a, b], lcg(seed + 100));
      expect(sorted(seen)).toEqual(sorted(PRONOUN_ORDER));
    }
  });

  it('после 9-го задания новый глагол, новый order, первый не равен последнему прежнего', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const random = lcg(seed);
      let s = startSession([a, b], random);
      s = { ...s, counter: { first: 2, second: 1, failed: 4 } };
      const { s: last } = runVerb(s, [a, b], random);
      const prevOrder = last.order;
      const prevLast = currentPronoun(last);
      expect(prevLast).toBe(prevOrder[8]);
      const t = nextTask(last, [a, b], random);
      expect(t.verb).not.toBe(last.verb);
      expect(t.index).toBe(0);
      expect(sorted(t.order)).toEqual(sorted(PRONOUN_ORDER));
      expect(currentPronoun(t)).not.toBe(prevLast);
      expect(t.counter).toEqual({ first: 2, second: 1, failed: 4 });
    }
  });

  it('новый order после 9-го задания строится заново (random=0 даёт сдвиг, первый не hum)', () => {
    let s = startSession([a, b], () => 0);
    const first = s.order;
    for (let i = 0; i < 9; i++) s = nextTask(s, [a, b], () => 0);
    expect(s.order).not.toBe(first);
    expect(s.verb).toBe(b);
    expect(s.order[0]).not.toBe(first[8]);
  });

  it('с одним глаголом сессия продолжается тем же глаголом, с новой перестановкой', () => {
    let s = startSession([a], lcg(3));
    const prevLast = s.order[8];
    for (let i = 0; i < 9; i++) s = nextTask(s, [a], lcg(4));
    expect(s.verb).toBe(a);
    expect(s.index).toBe(0);
    expect(currentPronoun(s)).not.toBe(prevLast);
  });

  it('nextTask не мутирует предыдущее состояние', () => {
    const s = startSession([a, b], () => 0);
    const snapshot = JSON.stringify(s);
    nextTask(s, [a, b], () => 0);
    let last = s;
    for (let i = 0; i < 8; i++) last = nextTask(last, [a, b], () => 0);
    const snap2 = JSON.stringify(last);
    nextTask(last, [a, b], () => 0);
    expect(JSON.stringify(s)).toBe(snapshot);
    expect(JSON.stringify(last)).toBe(snap2);
  });
});

describe('startSession с avoidFirst', () => {
  it('первое местоимение не равно avoidFirst, в т.ч. когда обычная перестановка начиналась бы с него', () => {
    const plain = startSession([a], () => 0).order;
    expect(startSession([a], () => 0, plain[0]).order[0]).not.toBe(plain[0]);
    for (const id of PRONOUN_ORDER) {
      for (let seed = 1; seed <= 20; seed++) {
        const s = startSession([a, b], lcg(seed), id);
        expect(s.order[0]).not.toBe(id);
        expect(sorted(s.order)).toEqual(sorted(PRONOUN_ORDER));
      }
    }
  });
});

describe('selectVerb', () => {
  it('первое местоимение нового order не равно местоимению прежнего состояния', () => {
    const s = startSession([a, b], () => 0);
    expect(shufflePronouns(() => 0)[0]).toBe(currentPronoun(s));
    expect(currentPronoun(selectVerb(s, b, () => 0))).not.toBe(currentPronoun(s));
    for (let seed = 1; seed <= 60; seed++) {
      let t = startSession([a, b, c], lcg(seed));
      t = nextTask(nextTask(t, [a, b, c], lcg(seed)), [a, b, c], lcg(seed));
      const u = selectVerb(t, c, lcg(seed + 500));
      expect(currentPronoun(u)).not.toBe(currentPronoun(t));
      expect(sorted(u.order)).toEqual(sorted(PRONOUN_ORDER));
    }
  });

  it('ставит глагол и index 0, новый order, счётчик сохраняется', () => {
    let s = startSession([a, b, c], () => 0);
    s = { ...s, counter: { first: 2, second: 1, failed: 4 } };
    s = nextTask(nextTask(s, [a, b, c], () => 0), [a, b, c], () => 0);
    expect(s.index).toBe(2);
    const t = selectVerb(s, c, () => 0.99);
    expect(t.verb).toBe(c);
    expect(t.index).toBe(0);
    expect(sorted(t.order)).toEqual(sorted(PRONOUN_ORDER));
    expect(t.order).toEqual(shufflePronouns(() => 0.99));
    expect(t.order).not.toEqual(s.order);
    expect(currentPronoun(t)).toBe(t.order[0]);
    expect(t.counter).toEqual({ first: 2, second: 1, failed: 4 });
  });

  it('не мутирует исходное состояние', () => {
    const s = startSession([a, b], () => 0);
    const snapshot = JSON.stringify(s);
    selectVerb(s, b, () => 0.5);
    expect(JSON.stringify(s)).toBe(snapshot);
  });

  it('дальше по новой перестановке, все 9 по разу, после девятого другой глагол', () => {
    let s = selectVerb(startSession([a, b], () => 0), b, lcg(11));
    const order = s.order;
    const seen: PronounId[] = [];
    for (let i = 0; i < 9; i++) {
      seen.push(currentPronoun(s));
      expect(s.verb).toBe(b);
      s = nextTask(s, [a, b], () => 0);
    }
    expect(seen).toEqual(order);
    expect(sorted(seen)).toEqual(sorted(PRONOUN_ORDER));
    expect(s.verb).toBe(a);
    expect(s.index).toBe(0);
  });
});
