import { describe, expect, it } from 'vitest';
import { stripMarks } from './plain';
import { PRONOUNS, pronounText } from './pronouns';
import type { PronounId } from '../engine/paradigm';

describe('PRONOUNS', () => {
  it('9 заданий в порядке п. 4 ТЗ', () => {
    expect(Object.keys(PRONOUNS)).toEqual(['hum', 'hiya', 'hunna', 'anta', 'antum', 'anti', 'antunna', 'ana', 'nahnu']);
  });

  it('описания по-русски из п. 4', () => {
    expect(Object.values(PRONOUNS).map((p) => p.description)).toEqual([
      '3 л., м. р., мн. ч.',
      '3 л., ж. р., ед. ч.',
      '3 л., ж. р., мн. ч.',
      '2 л., м. р., ед. ч.',
      '2 л., м. р., мн. ч.',
      '2 л., ж. р., ед. ч.',
      '2 л., ж. р., мн. ч.',
      '1 л., ед. ч.',
      '1 л., мн. ч.',
    ]);
  });

  it('арабские названия: только арабские буквы и знаки, без татвиля', () => {
    for (const p of Object.values(PRONOUNS)) {
      expect(p.arabic).toMatch(/^[\u0621-\u063a\u0641-\u064a\u064b-\u0652]+$/);
    }
  });

  it('шадда стоит перед огласовкой (порядок п. 6)', () => {
    expect(PRONOUNS.hunna.arabic.endsWith('\u0651\u064e')).toBe(true);
    expect(PRONOUNS.antunna.arabic.endsWith('\u0651\u064e')).toBe(true);
  });

  it('точные арабские названия (кодпоинты)', () => {
    const expected = {
      hum: '\u0647\u064f\u0645\u0652',
      hiya: '\u0647\u0650\u064a\u064e',
      hunna: '\u0647\u064f\u0646\u0651\u064e',
      anta: '\u0623\u064e\u0646\u0652\u062a\u064e',
      antum: '\u0623\u064e\u0646\u0652\u062a\u064f\u0645\u0652',
      anti: '\u0623\u064e\u0646\u0652\u062a\u0650',
      antunna: '\u0623\u064e\u0646\u0652\u062a\u064f\u0646\u0651\u064e',
      ana: '\u0623\u064e\u0646\u064e\u0627',
      nahnu: '\u0646\u064e\u062d\u0652\u0646\u064f',
    } as const;
    for (const [id, arabic] of Object.entries(expected)) {
      expect(PRONOUNS[id as keyof typeof PRONOUNS].arabic).toBe(arabic);
    }
  });
});

describe('pronounText', () => {
  const ids = Object.keys(PRONOUNS) as PronounId[];
  const MARKS_RE = /[\u064b-\u0652]/;

  it('с огласовками: полные строки', () => {
    for (const id of ids) expect(pronounText(id, false)).toBe(PRONOUNS[id].arabic);
  });

  it('без огласовок: без знаков для всех, кроме anti', () => {
    for (const id of ids.filter((i) => i !== 'anti')) {
      expect(pronounText(id, true)).toBe(stripMarks(PRONOUNS[id].arabic));
      expect(pronounText(id, true)).not.toMatch(MARKS_RE);
    }
  });

  it('без огласовок: anti ровно три буквы с одной кясрой под ت (U+0650)', () => {
    expect(pronounText('anti', true)).toBe('\u0623\u0646\u062a\u0650');
  });

  it('plain-строки anta и anti различаются', () => {
    expect(pronounText('anta', true)).not.toBe(pronounText('anti', true));
  });
});
