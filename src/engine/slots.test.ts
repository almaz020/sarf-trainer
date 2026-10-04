import { describe, expect, it } from 'vitest';
import { slotsEqual, slotsToString, type Haraka, type Slot } from './slots';

const s = (letter: string, haraka: Haraka | null, shadda = false): Slot => ({ letter, shadda, haraka });
const F = '\u064E', D = '\u064F', S = '\u0652', SH = '\u0651';

const mutate = (slots: Slot[], i: number, patch: Partial<Slot>): Slot[] =>
  slots.map((x, j) => (j === i ? { ...x, ...patch } : { ...x }));

const hum: Slot[] = [s('ن', 'fatha'), s('ص', 'fatha'), s('ر', 'damma'), s('و', null), s('ا', null)];
const antum: Slot[] = [s('ن', 'fatha'), s('ص', 'fatha'), s('ر', 'sukun'), s('ت', 'damma'), s('م', 'sukun')];
const antunna: Slot[] = [s('ن', 'fatha'), s('ص', 'fatha'), s('ر', 'sukun'), s('ت', 'damma'), s('ن', 'fatha', true)];
const huwa: Slot[] = [s('ن', 'fatha'), s('ص', 'fatha'), s('ر', 'fatha')];

describe('slotsToString', () => {
  it('буква → шадда → огласовка; буквы удлинения без знаков', () => {
    expect(slotsToString(antunna)).toBe(`ن${F}ص${F}ر${S}ت${D}ن${SH}${F}`);
    expect(slotsToString(hum)).toBe(`ن${F}ص${F}ر${D}وا`);
    expect(slotsToString(antum)).toBe(`ن${F}ص${F}ر${S}ت${D}م${S}`);
    expect(slotsToString([])).toBe('');
  });

  it('не нормализует: порядок ТЗ п. 6 отличается от NFC', () => {
    const str = slotsToString(antunna);
    expect(str.normalize('NFC')).not.toBe(str);
    expect(str.normalize('NFC')).toBe(`ن${F}ص${F}ر${S}ت${D}ن${F}${SH}`);
  });
});

describe('slotsEqual', () => {
  it('равные массивы равны, исходные не меняются', () => {
    expect(slotsEqual(antunna, antunna.map((x) => ({ ...x })))).toBe(true);
    expect(slotsEqual([], [])).toBe(true);
  });

  it('разная длина', () => {
    expect(slotsEqual(huwa, huwa.slice(0, 2))).toBe(false);
    expect(slotsEqual(huwa, [])).toBe(false);
  });

  it('пропущенный сукун', () => {
    expect(slotsEqual(antum, mutate(antum, 4, { haraka: null }))).toBe(false);
  });

  it('лишний сукун', () => {
    expect(slotsEqual(huwa, mutate(huwa, 2, { haraka: 'sukun' }))).toBe(false);
  });

  it('сукун на букве удлинения', () => {
    expect(slotsEqual(hum, mutate(hum, 3, { haraka: 'sukun' }))).toBe(false);
    expect(slotsEqual(hum, mutate(hum, 4, { haraka: 'sukun' }))).toBe(false);
  });

  it('шадда не на той букве / пропущена / лишняя', () => {
    expect(slotsEqual(antunna, mutate(mutate(antunna, 4, { shadda: false }), 3, { shadda: true }))).toBe(false);
    expect(slotsEqual(antunna, mutate(antunna, 4, { shadda: false }))).toBe(false);
    expect(slotsEqual(antum, mutate(antum, 4, { shadda: true }))).toBe(false);
  });

  it('другая огласовка и другая буква', () => {
    expect(slotsEqual(antum, mutate(antum, 3, { haraka: 'kasra' }))).toBe(false);
    expect(slotsEqual(antum, mutate(antum, 3, { letter: 'ن' }))).toBe(false);
  });
});
