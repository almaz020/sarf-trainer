import { describe, expect, it } from 'vitest';
import { conjugatePast } from './conjugate';
import type { RuleId, Verb } from './paradigm';
import { slotsEqual, slotsToString, type Haraka, type Slot } from './slots';

const s = (letter: string, haraka: Haraka | null, shadda = false): Slot => ({ letter, shadda, haraka });
const F = '\u064E', D = '\u064F', K = '\u0650', S = '\u0652', SH = '\u0651';

const IDS: RuleId[] = ['huwa', 'hum', 'hiya', 'hunna', 'anta', 'antum', 'anti', 'antunna', 'ana', 'nahnu'];

// Огласовка R3 и окончание (ТЗ п. 5), по id
const tail: Record<RuleId, { r3: Haraka; suffix: Slot[] }> = {
  huwa: { r3: 'fatha', suffix: [] },
  hum: { r3: 'damma', suffix: [s('و', null), s('ا', null)] },
  hiya: { r3: 'fatha', suffix: [s('ت', 'sukun')] },
  hunna: { r3: 'sukun', suffix: [s('ن', 'fatha')] },
  anta: { r3: 'sukun', suffix: [s('ت', 'fatha')] },
  antum: { r3: 'sukun', suffix: [s('ت', 'damma'), s('م', 'sukun')] },
  anti: { r3: 'sukun', suffix: [s('ت', 'kasra')] },
  antunna: { r3: 'sukun', suffix: [s('ت', 'damma'), s('ن', 'fatha', true)] },
  ana: { r3: 'sukun', suffix: [s('ت', 'damma')] },
  nahnu: { r3: 'sukun', suffix: [s('ن', 'fatha'), s('ا', null)] },
};

const tailStr: Record<RuleId, string> = {
  huwa: F,
  hum: `${D}وا`,
  hiya: `${F}ت${S}`,
  hunna: `${S}ن${F}`,
  anta: `${S}ت${F}`,
  antum: `${S}ت${D}م${S}`,
  anti: `${S}ت${K}`,
  antunna: `${S}ت${D}ن${SH}${F}`,
  ana: `${S}ت${D}`,
  nahnu: `${S}ن${F}ا`,
};

const mk = (id: string, root: [string, string, string], midVowel: Verb['midVowel']): Verb => ({
  id,
  root,
  midVowel,
  sources: [],
  verified: false,
});

// نَصَرَ, سَمِعَ, كَرُمَ
const golden = [
  { verb: mk('nasara', ['ن', 'ص', 'ر'], 'fatha'), stem: [s('ن', 'fatha'), s('ص', 'fatha')], stemStr: `ن${F}ص${F}`, r3: 'ر' },
  { verb: mk('sami3a', ['س', 'م', 'ع'], 'kasra'), stem: [s('س', 'fatha'), s('م', 'kasra')], stemStr: `س${F}م${K}`, r3: 'ع' },
  { verb: mk('karuma', ['ك', 'ر', 'م'], 'damma'), stem: [s('ك', 'fatha'), s('ر', 'damma')], stemStr: `ك${F}ر${D}`, r3: 'م' },
];

describe('conjugatePast: golden (ТЗ п. 10)', () => {
  for (const g of golden) {
    for (const id of IDS) {
      const p = id;
      it(`${g.verb.id} / ${id}: Slot[]`, () => {
        const expected = [...g.stem, s(g.r3, tail[id].r3), ...tail[id].suffix];
        const actual = conjugatePast(g.verb, p);
        expect(actual).toEqual(expected);
        expect(slotsEqual(actual, expected)).toBe(true);
      });

      it(`${g.verb.id} / ${id}: строка`, () => {
        expect(slotsToString(conjugatePast(g.verb, p))).toBe(g.stemStr + g.r3 + tailStr[id]);
      });
    }
  }

  it('литеральные эталоны (независимо от таблиц выше)', () => {
    const nasara = golden[0].verb;
    expect(conjugatePast(nasara, 'antunna')).toEqual([
      s('ن', 'fatha'), s('ص', 'fatha'), s('ر', 'sukun'), s('ت', 'damma'), s('ن', 'fatha', true),
    ]);
    expect(conjugatePast(nasara, 'hum')).toEqual([
      s('ن', 'fatha'), s('ص', 'fatha'), s('ر', 'damma'), s('و', null), s('ا', null),
    ]);
    expect(conjugatePast(nasara, 'nahnu')).toEqual([
      s('ن', 'fatha'), s('ص', 'fatha'), s('ر', 'sukun'), s('ن', 'fatha'), s('ا', null),
    ]);
  });
});

describe('conjugatePast: входы вне таблицы', () => {
  it('буква корня = буква окончания: слияния нет (كتب, anta)', () => {
    const kataba = mk('kataba', ['ك', 'ت', 'ب'], 'fatha');
    expect(conjugatePast(kataba, 'anta')).toEqual([
      s('ك', 'fatha'), s('ت', 'fatha'), s('ب', 'sukun'), s('ت', 'fatha'),
    ]);
    const nasara = golden[0].verb;
    expect(conjugatePast(nasara, 'nahnu').filter((x) => x.letter === 'ن')).toHaveLength(2);
  });

  it('результат не делит объекты с paradigm.json', () => {
    const nasara = golden[0].verb;
    const first = conjugatePast(nasara, 'antunna');
    first[3].haraka = 'kasra';
    first[4].shadda = false;
    expect(conjugatePast(nasara, 'antunna')[3]).toEqual(s('ت', 'damma'));
    expect(conjugatePast(nasara, 'antunna')[4]).toEqual(s('ن', 'fatha', true));
  });
});
