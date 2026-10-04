import { describe, expect, it } from 'vitest';
import { paradigm } from './paradigm';
import { validateParadigm } from './validate';

const RULE_IDS = ['huwa', 'hum', 'hiya', 'hunna', 'anta', 'antum', 'anti', 'antunna', 'ana', 'nahnu'];
const CONVENTION_IDS = ['stem', 'no-sign-on-madd-letters', 'other-letters-vowelled'];
const entries = [...paradigm.rules, ...paradigm.conventions];

describe('paradigm.json: структура', () => {
  it('10 правил в порядке п. 4 и 3 соглашения', () => {
    expect(paradigm.rules.map((r) => r.id)).toEqual(RULE_IDS);
    expect(paradigm.conventions.map((c) => c.id)).toEqual(CONVENTION_IDS);
  });

  it('у каждой записи есть место под основной источник, роли допустимы', () => {
    for (const e of entries) {
      expect(e.sources.some((x) => x.role === 'primary'), e.id).toBe(true);
      for (const x of e.sources) expect(['primary', 'check'], e.id).toContain(x.role);
    }
  });

  it('haraka null только у букв удлинения (و и ا)', () => {
    for (const r of paradigm.rules)
      for (const sl of r.suffix) expect(sl.haraka === null, r.id).toBe(sl.letter === 'و' || sl.letter === 'ا');
  });

  it('шадда только в окончании antunna', () => {
    const withShadda = paradigm.rules.filter((r) => r.suffix.some((sl) => sl.shadda)).map((r) => r.id);
    expect(withShadda).toEqual(['antunna']);
  });
});

describe('paradigm.json: источники', () => {
  // Красный, пока владелец не заполнит ссылки (ТЗ п. 12, этап 1). В сообщении об ошибке видны id записей.
  it('у каждого правила и соглашения заполнен основной источник (book, edition, section, page)', () => {
    expect(validateParadigm()).toEqual([]);
  });
});
