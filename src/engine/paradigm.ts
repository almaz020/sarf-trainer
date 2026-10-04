import raw from '../data/paradigm.json';
import type { Haraka, Slot } from './slots';

export type PronounId = 'hum' | 'hiya' | 'hunna' | 'anta' | 'antum' | 'anti' | 'antunna' | 'ana' | 'nahnu';
export type RuleId = PronounId | 'huwa';

export interface SourceRef {
  role: 'primary' | 'check';
  book: string;
  author?: string;
  edition: string;
  entry?: string;
  section?: string;
  volume?: string;
  page: string;
}

export interface Rule {
  id: RuleId;
  r3Haraka: Haraka;
  suffix: Slot[];
  sources: SourceRef[];
}

export interface Convention {
  id: string;
  text: string;
  sources: SourceRef[];
}

export interface Paradigm {
  rules: Rule[];
  conventions: Convention[];
}

export interface Verb {
  id: string;
  root: [string, string, string];
  midVowel: 'fatha' | 'kasra' | 'damma';
  sources: SourceRef[];
  verified: boolean;
}

export const paradigm = raw as unknown as Paradigm;

export function ruleFor(id: RuleId): Rule {
  return paradigm.rules.find((r) => r.id === id)!;
}
