import { describe, expect, it } from 'vitest';
import { conjugatePast } from '../engine/conjugate';
import { slotsToString } from '../engine/slots';
import { demoVerbs } from './demo';
import { normalizeArabic, searchVerbs, verbForm } from './verbSearch';

const [nasara, sami3a, karuma] = demoVerbs;
const NASARA_VOWELLED = 'ن\u064eص\u064eر\u064e';

describe('normalizeArabic', () => {
  it('убирает знаки U+064B-U+0652', () => {
    expect(normalizeArabic(NASARA_VOWELLED)).toBe('نصر');
    expect(normalizeArabic('ك\u064b\u064c\u064d\u064e\u064f\u0650\u0651\u0652')).toBe('ك');
  });
  it('убирает татвиль', () => {
    expect(normalizeArabic('ن\u0640ص')).toBe('نص');
  });
  it('буквы не меняет', () => {
    expect(normalizeArabic('أإاةى')).toBe('أإاةى');
  });
  it('обрезает пробелы по краям, внутренние не трогает', () => {
    expect(normalizeArabic('  ن ص  ')).toBe('ن ص');
  });
});

describe('verbForm', () => {
  it('форма هو без знаков', () => {
    expect(verbForm(nasara)).toBe('نصر');
    expect(verbForm(sami3a)).toBe('سمع');
    expect(verbForm(karuma)).toBe('كرم');
  });
  it('совпадает с normalizeArabic(slotsToString(conjugatePast(huwa)))', () => {
    for (const v of demoVerbs) {
      expect(verbForm(v)).toBe(normalizeArabic(slotsToString(conjugatePast(v, 'huwa'))));
    }
  });
});

describe('searchVerbs', () => {
  it('пустой запрос: все глаголы в исходном порядке', () => {
    expect(searchVerbs(demoVerbs, '')).toEqual(demoVerbs);
  });
  it('пробельный запрос: все глаголы', () => {
    expect(searchVerbs(demoVerbs, '   ')).toEqual(demoVerbs);
  });
  it('по корню', () => {
    expect(searchVerbs(demoVerbs, 'نصر')).toEqual([nasara]);
    expect(searchVerbs(demoVerbs, 'سمع')).toEqual([sami3a]);
  });
  it('по части корня', () => {
    expect(searchVerbs(demoVerbs, 'صر')).toEqual([nasara]);
    expect(searchVerbs(demoVerbs, 'م')).toEqual([sami3a, karuma]);
  });
  it('по форме', () => {
    expect(searchVerbs(demoVerbs, 'كرم')).toEqual([karuma]);
  });
  it('запрос с огласовками находит глагол', () => {
    expect(searchVerbs(demoVerbs, NASARA_VOWELLED)).toEqual([nasara]);
  });
  it('запрос с разными знаками даёт тот же результат', () => {
    const a = searchVerbs(demoVerbs, 'ن\u064eص\u0652ر');
    const b = searchVerbs(demoVerbs, 'ن\u064fص\u0651ر\u064b');
    expect(a).toEqual([nasara]);
    expect(b).toEqual([nasara]);
  });
  it('запрос с пробелами по краям', () => {
    expect(searchVerbs(demoVerbs, '  نصر ')).toEqual([nasara]);
  });
  it('запрос только из знаков, татвиля или знаков с пробелами: все глаголы в исходном порядке', () => {
    expect(searchVerbs(demoVerbs, '\u064e\u0651')).toEqual(demoVerbs);
    expect(searchVerbs(demoVerbs, '\u0640')).toEqual(demoVerbs);
    expect(searchVerbs(demoVerbs, '  \u064e  ')).toEqual(demoVerbs);
  });
  it('нет совпадений: пустой массив', () => {
    expect(searchVerbs(demoVerbs, 'ببب')).toEqual([]);
  });
  it('порядок сохраняется', () => {
    const rev = [karuma, sami3a, nasara];
    expect(searchVerbs(rev, 'م')).toEqual([karuma, sami3a]);
    expect(searchVerbs(rev, '')).toEqual(rev);
  });
  it('вход не мутируется', () => {
    const input = [...demoVerbs];
    const snapshot = JSON.stringify(input);
    const out = searchVerbs(input, '');
    searchVerbs(input, 'ص');
    expect(JSON.stringify(input)).toBe(snapshot);
    expect(out).not.toBe(input);
  });
});
