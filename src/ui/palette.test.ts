import { describe, expect, it } from 'vitest';
import verbs from '../data/verbs.json';
import { conjugatePast } from '../engine/conjugate';
import type { Verb } from '../engine/paradigm';
import { ARABIC_KEYS } from './keyboard';
import { BASE_EXTRA, buildPalette, EXTRA_COUNT } from './palette';
import { PRONOUN_ORDER } from './session';

function lcg(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const required = (root: string[]) => [...new Set([...root, ...BASE_EXTRA])];
const ROOTS = [
  ['ك', 'ت', 'ب'],
  ['ن', 'ص', 'ر'],
  ['ك', 'ر', 'م'],
  ['م', 'ن', 'ع'],
];

describe('buildPalette', () => {
  it('константы', () => {
    expect(EXTRA_COUNT).toBe(5);
    expect(BASE_EXTRA).toEqual(['ت', 'ن', 'و', 'ا', 'م']);
  });

  it('содержит все обязательные буквы для разных корней', () => {
    for (const root of ROOTS) {
      for (const seed of [1, 2, 3]) {
        const p = buildPalette(root, lcg(seed));
        for (const l of required(root)) expect(p).toContain(l);
      }
    }
  });

  it('ровно 5 лишних сверх обязательных, без дублей, лишние из ARABIC_KEYS', () => {
    for (const root of ROOTS) {
      const req = required(root);
      const p = buildPalette(root, lcg(7));
      expect(new Set(p).size).toBe(p.length);
      const extras = p.filter((l) => !req.includes(l));
      expect(extras).toHaveLength(5);
      expect(p).toHaveLength(req.length + 5);
      for (const l of extras) expect(ARABIC_KEYS).toContain(l);
    }
  });

  it('зависит от random', () => {
    const a = buildPalette(ROOTS[0], () => 0);
    const b = buildPalette(ROOTS[0], () => 0.99);
    expect(a).not.toEqual(b);
  });

  it('детерминирован при фиксированном random', () => {
    expect(buildPalette(ROOTS[1], lcg(4))).toEqual(buildPalette(ROOTS[1], lcg(4)));
  });

  it('не мутирует вход', () => {
    const root = ['ك', 'ت', 'ب'];
    buildPalette(root, lcg(1));
    expect(root).toEqual(['ك', 'ت', 'ب']);
  });

  it('extraCount=0 даёт только обязательные', () => {
    const p = buildPalette(ROOTS[0], lcg(1), 0);
    expect([...p].sort()).toEqual([...required(ROOTS[0])].sort());
  });

  it('extraCount больше пула: берёт сколько есть', () => {
    const root = ROOTS[0];
    const req = required(root);
    const pool = ARABIC_KEYS.filter((l) => !req.includes(l));
    const p = buildPalette(root, lcg(1), 100);
    expect(p).toHaveLength(req.length + pool.length);
    expect(new Set(p).size).toBe(p.length);
  });
});

describe('buildPalette: форму всегда можно собрать', () => {
  it('для каждого глагола и каждого местоимения все буквы формы есть в палитре', () => {
    const all = verbs as unknown as Verb[];
    expect(all.length).toBeGreaterThan(0);
    for (const verb of all) {
      for (const seed of [1, 2, 3]) {
        const palette = buildPalette(verb.root, lcg(seed));
        for (const pr of PRONOUN_ORDER) {
          for (const slot of conjugatePast(verb, pr)) {
            expect(palette, `${verb.id} ${pr} ${slot.letter}`).toContain(slot.letter);
          }
        }
      }
    }
  });
});
