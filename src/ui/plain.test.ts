import { describe, expect, it } from 'vitest';
import { PRONOUNS } from './pronouns';
import { stripMarks } from './plain';

describe('stripMarks', () => {
  it('убирает фатху, дамму, касру, сукун, шадду', () => {
    for (const mark of ['\u064e', '\u064f', '\u0650', '\u0652', '\u0651']) {
      expect(stripMarks('\u0646' + mark)).toBe('\u0646');
    }
  });

  it('убирает комбинацию шадда + фатха', () => {
    expect(stripMarks('\u0646\u0651\u064e')).toBe('\u0646');
  });

  it('убирает весь диапазон U+064B-U+0652', () => {
    for (let c = 0x064b; c <= 0x0652; c++) {
      expect(stripMarks('\u0646' + String.fromCharCode(c))).toBe('\u0646');
    }
  });

  it('буквы без знаков и татвиль не меняются', () => {
    expect(stripMarks('\u0646\u0635\u0631')).toBe('\u0646\u0635\u0631');
    expect(stripMarks('\u0646\u0640\u0635')).toBe('\u0646\u0640\u0635');
  });

  it('форма нصر с огласовками даёт نصر', () => {
    expect(stripMarks('\u0646\u064e\u0635\u064e\u0631\u064e')).toBe('\u0646\u0635\u0631');
  });

  it('أنتن для antunna (шадда убирается, удвоенная буква не восстанавливается)', () => {
    expect(stripMarks(PRONOUNS.antunna.arabic)).toBe('\u0623\u0646\u062a\u0646');
  });
});
