import { describe, expect, it } from 'vitest';
import { validateVerb } from '../engine/validate';
import { ARABIC_KEYS, applyKey } from './keyboard';

const EXPECTED = [
  'ب', 'ت', 'ث', 'ج', 'ح', 'خ', 'د', 'ذ', 'ر', 'ز',
  'س', 'ش', 'ص', 'ض', 'ط', 'ظ', 'ع', 'غ', 'ف', 'ق',
  'ك', 'ل', 'م', 'ن', 'ه',
];
const FORBIDDEN = Array.from('وياىءأإؤئآة');

describe('ARABIC_KEYS', () => {
  it('25 уникальных букв в заданном порядке', () => {
    expect(ARABIC_KEYS).toEqual(EXPECTED);
    expect(new Set(ARABIC_KEYS).size).toBe(25);
  });

  it('все — базовые арабские буквы U+0621–U+064A, без запрещённых для корня', () => {
    for (const k of ARABIC_KEYS) {
      expect(k.length).toBe(1);
      const c = k.charCodeAt(0);
      expect(c >= 0x0621 && c <= 0x064a).toBe(true);
      expect(FORBIDDEN).not.toContain(k);
    }
  });

  it('validateVerb: корень [буква, ص, ر] не даёт FORBIDDEN_LETTER и NOT_BASE_LETTER', () => {
    for (const k of ARABIC_KEYS) {
      const issues = validateVerb({ root: [k, 'ص', 'ر'], midVowel: 'fatha', sources: [], verified: true });
      expect(issues).not.toContain('FORBIDDEN_LETTER');
      expect(issues).not.toContain('NOT_BASE_LETTER');
    }
  });
});

describe('applyKey', () => {
  it('letter добавляет букву в конец', () => {
    expect(applyKey('', { type: 'letter', letter: 'ن' })).toBe('ن');
    expect(applyKey('نص', { type: 'letter', letter: 'ر' })).toBe('نصر');
  });

  it('backspace удаляет последний символ', () => {
    expect(applyKey('نصر', { type: 'backspace' })).toBe('نص');
    expect(applyKey('ن', { type: 'backspace' })).toBe('');
    expect(applyKey('', { type: 'backspace' })).toBe('');
  });

  it('backspace удаляет последний code point, в том числе знак', () => {
    expect(applyKey('ن\u064e', { type: 'backspace' })).toBe('ن');
    expect(applyKey('a\u{1F600}', { type: 'backspace' })).toBe('a');
  });

  it('clear даёт пустую строку', () => {
    expect(applyKey('نصر', { type: 'clear' })).toBe('');
    expect(applyKey('', { type: 'clear' })).toBe('');
  });

  it('исходная строка не меняется', () => {
    const s = 'نص';
    applyKey(s, { type: 'backspace' });
    applyKey(s, { type: 'letter', letter: 'ر' });
    applyKey(s, { type: 'clear' });
    expect(s).toBe('نص');
  });
});
