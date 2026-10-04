import { describe, expect, it } from 'vitest';
import { filterVerbs, validateParadigm, validateVerb } from './validate';
import type { Paradigm } from './paradigm';

// Фикстуры: значения TEST-… не являются реальными ссылками
const dict = { role: 'primary', book: 'المعجم الوسيط', entry: 'TEST-ENTRY', edition: 'TEST-EDITION', page: 'TEST-PAGE' };
const base = { id: 't', root: ['ن', 'ص', 'ر'], midVowel: 'fatha', sources: [dict], verified: true };
const v = (patch: Record<string, unknown>) => ({ ...base, ...patch });

describe('validateVerb', () => {
  it('валидные глаголы', () => {
    expect(validateVerb(base)).toEqual([]);
    expect(validateVerb(v({ root: ['س', 'م', 'ع'], midVowel: 'kasra' }))).toEqual([]);
    expect(validateVerb(v({ root: ['ك', 'ر', 'م'], midVowel: 'damma' }))).toEqual([]);
  });

  it.each([
    ['قال (قول)', ['ق', 'و', 'ل']],
    ['دعا (دعو)', ['د', 'ع', 'و']],
    ['وعد', ['و', 'ع', 'د']],
    ['أكل', ['أ', 'ك', 'ل']],
  ])('п. 2: %s', (_n, root) => {
    expect(validateVerb(v({ root }))).toEqual(['FORBIDDEN_LETTER']);
  });

  it('п. 3: مد\u0651 (مدد), удвоенный', () => {
    expect(validateVerb(v({ root: ['م', 'د', 'د'] }))).toEqual(['GEMINATE']);
  });

  it.each([
    ['سكت', ['س', 'ك', 'ت']],
    ['سكن', ['س', 'ك', 'ن']],
  ])('п. 4: %s', (_n, root) => {
    expect(validateVerb(v({ root }))).toEqual(['R3_T_OR_N']);
  });

  it('п. 1: не три буквы', () => {
    expect(validateVerb(v({ root: ['ن', 'ص'] }))).toEqual(['ROOT_LENGTH']);
    expect(validateVerb(v({ root: ['ن', 'ص', 'ر', 'ك'] }))).toEqual(['ROOT_LENGTH']);
  });

  it('п. 5: не базовая буква', () => {
    expect(validateVerb(v({ root: ['ن\u064E', 'ص', 'ر'] }))).toEqual(['NOT_BASE_LETTER']);
    expect(validateVerb(v({ root: ['\u0640', 'ص', 'ر'] }))).toEqual(['NOT_BASE_LETTER']);
    expect(validateVerb(v({ root: ['ن', 'ص', '\u063B'] }))).toEqual(['NOT_BASE_LETTER']);
    expect(validateVerb(v({ root: ['a', 'ص', 'ر'] }))).toEqual(['NOT_BASE_LETTER']);
  });

  it('п. 6: midVowel', () => {
    expect(validateVerb(v({ midVowel: 'sukun' }))).toEqual(['BAD_MID_VOWEL']);
    expect(validateVerb(v({ midVowel: undefined }))).toEqual(['BAD_MID_VOWEL']);
  });

  it('п. 7: нужен основной словарь с заполненными book, entry, edition, page', () => {
    expect(validateVerb(v({ sources: [] }))).toEqual(['NO_PRIMARY_DICTIONARY']);
    expect(validateVerb(v({ sources: [{ ...dict, role: 'check' }] }))).toEqual(['NO_PRIMARY_DICTIONARY']);
    expect(validateVerb(v({ sources: [{ ...dict, page: '' }] }))).toEqual(['NO_PRIMARY_DICTIONARY']);
    expect(validateVerb(v({ sources: [{ ...dict, entry: undefined }] }))).toEqual(['NO_PRIMARY_DICTIONARY']);
  });

  it('п. 7: поля из одних пробелов считаются пустыми', () => {
    expect(validateVerb(v({ sources: [{ ...dict, edition: '   ' }] }))).toEqual(['NO_PRIMARY_DICTIONARY']);
  });

  it('п. 7: достаточно одного заполненного основного среди нескольких', () => {
    expect(validateVerb(v({ sources: [{ ...dict, role: 'check' }, dict] }))).toEqual([]);
  });

  it('п. 8: verified', () => {
    expect(validateVerb(v({ verified: false }))).toEqual(['NOT_VERIFIED']);
    expect(validateVerb(v({ verified: 'true' }))).toEqual(['NOT_VERIFIED']);
  });

  it('несколько нарушений возвращаются все, в порядке пунктов', () => {
    expect(validateVerb(v({ root: ['و', 'د', 'د'], verified: false }))).toEqual([
      'FORBIDDEN_LETTER',
      'GEMINATE',
      'NOT_VERIFIED',
    ]);
  });

  it('мусорный вход не бросает исключение', () => {
    for (const junk of [null, undefined, 'نصر', 42, [], {}, v({ root: 'نصر' }), v({ root: [1, null, {}] }), v({ sources: 'x' }), v({ sources: [null, 3] })]) {
      expect(() => validateVerb(junk)).not.toThrow();
      expect(validateVerb(junk).length).toBeGreaterThan(0);
    }
  });

  it.each([
    ['ي'], ['ا'], ['ى'], ['ء'], ['أ'], ['إ'],
    ['ؤ'], ['ئ'], ['آ'], ['ة'], ['و'],
  ])('запрещённая буква R1 %s', (letter) => {
    expect(validateVerb(v({ root: [letter, 'ص', 'ر'] }))).toEqual(['FORBIDDEN_LETTER']);
  });

  it('поле book обязательно', () => {
    expect(validateVerb(v({ sources: [{ ...dict, book: '' }] }))).toEqual(['NO_PRIMARY_DICTIONARY']);
  });

  it.each([['\u064B'], ['\u064E'], ['\u0652']])('одиночный знак U+%s как буква не базовая', (mark) => {
    expect(validateVerb(v({ root: [mark, 'ص', 'ر'] }))).toEqual(['NOT_BASE_LETTER']);
  });
});

describe('filterVerbs', () => {
  it('разделяет валидные и отклонённые с причинами', () => {
    const bad = v({ verified: false });
    const { valid, rejected } = filterVerbs([base, bad]);
    expect(valid).toEqual([base]);
    expect(rejected).toEqual([{ verb: bad, issues: ['NOT_VERIFIED'] }]);
  });

  it('пустой массив', () => {
    expect(filterVerbs([])).toEqual({ valid: [], rejected: [] });
  });
});

describe('validateParadigm', () => {
  const full = { role: 'primary', book: 'TEST-BOOK', edition: 'TEST-EDITION', section: 'TEST-SECTION', page: 'TEST-PAGE' };
  const mk = (sources: unknown[]): Paradigm =>
    ({
      rules: [{ id: 'huwa', r3Haraka: 'fatha', suffix: [], sources }],
      conventions: [{ id: 'stem', text: 'x', sources: [full] }],
    }) as unknown as Paradigm;

  it('всё заполнено', () => {
    expect(validateParadigm(mk([full]))).toEqual([]);
  });

  it('возвращает id записи без заполненного основного источника', () => {
    expect(validateParadigm(mk([]))).toEqual(['huwa']);
    expect(validateParadigm(mk([{ ...full, book: '' }]))).toEqual(['huwa']);
    expect(validateParadigm(mk([{ ...full, edition: '' }]))).toEqual(['huwa']);
    expect(validateParadigm(mk([{ ...full, section: '' }]))).toEqual(['huwa']);
    expect(validateParadigm(mk([{ ...full, page: '  ' }]))).toEqual(['huwa']);
    expect(validateParadigm(mk([{ ...full, role: 'check' }]))).toEqual(['huwa']);
  });

  it('основной источник среди нескольких', () => {
    expect(validateParadigm(mk([{ ...full, role: 'check' }, full]))).toEqual([]);
  });
});
