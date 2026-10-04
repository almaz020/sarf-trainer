import { describe, expect, it } from 'vitest';
import verbs from '../data/verbs.json';
import { filterVerbs } from './validate';

describe('verbs.json', () => {
  it('это массив', () => {
    expect(Array.isArray(verbs)).toBe(true);
  });

  it('нет невалидных записей среди verified: true', () => {
    const { rejected } = filterVerbs(verbs as unknown[]);
    const broken = rejected.filter((r) => (r.verb as { verified?: unknown }).verified === true);
    expect(broken).toEqual([]);
  });
});
