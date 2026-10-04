import { paradigm as defaultParadigm, type Paradigm, type Verb } from './paradigm';

export type VerbIssue =
  | 'ROOT_LENGTH'
  | 'FORBIDDEN_LETTER'
  | 'GEMINATE'
  | 'R3_T_OR_N'
  | 'NOT_BASE_LETTER'
  | 'BAD_MID_VOWEL'
  | 'NO_PRIMARY_DICTIONARY'
  | 'NOT_VERIFIED';

// و ي ا ى ء أ إ ؤ ئ آ ة
const FORBIDDEN_LETTERS = new Set(Array.from('وياىءأإؤئآة'));
const TA = 'ت';
const NUN = 'ن';
const MID_VOWELS = ['fatha', 'kasra', 'damma'];

export const filled = (x: unknown): boolean => typeof x === 'string' && x.trim() !== '';

// Базовая арабская буква U+0621–U+064A, кроме татвиля U+0640 и неназначенных U+063B–U+063F
function isBaseLetter(x: unknown): boolean {
  if (typeof x !== 'string' || x.length !== 1) return false;
  const c = x.charCodeAt(0);
  return c >= 0x0621 && c <= 0x064a && c !== 0x0640 && !(c >= 0x063b && c <= 0x063f);
}

export function hasFilledPrimary(sources: unknown, fields: string[]): boolean {
  return (
    Array.isArray(sources) &&
    sources.some((src) => {
      if (src === null || typeof src !== 'object') return false;
      const r = src as Record<string, unknown>;
      return r.role === 'primary' && fields.every((f) => filled(r[f]));
    })
  );
}

export function validateVerb(input: unknown): VerbIssue[] {
  const v = (input !== null && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const root: unknown[] = Array.isArray(v.root) ? v.root : [];
  const issues: VerbIssue[] = [];

  if (!Array.isArray(v.root) || v.root.length !== 3) issues.push('ROOT_LENGTH');
  if (root.some((l) => typeof l === 'string' && FORBIDDEN_LETTERS.has(l))) issues.push('FORBIDDEN_LETTER');
  if (root[1] !== undefined && root[1] === root[2]) issues.push('GEMINATE');
  if (root[2] === TA || root[2] === NUN) issues.push('R3_T_OR_N');
  if (root.some((l) => !isBaseLetter(l))) issues.push('NOT_BASE_LETTER');
  if (!MID_VOWELS.includes(v.midVowel as string)) issues.push('BAD_MID_VOWEL');
  if (!hasFilledPrimary(v.sources, ['book', 'entry', 'edition', 'page'])) issues.push('NO_PRIMARY_DICTIONARY');
  if (v.verified !== true) issues.push('NOT_VERIFIED');

  return issues;
}

export interface RejectedVerb {
  verb: unknown;
  issues: VerbIssue[];
}

// Предупреждения в консоль выводит вызывающий слой (UI), не движок.
export function filterVerbs(raw: unknown[]): { valid: Verb[]; rejected: RejectedVerb[] } {
  const valid: Verb[] = [];
  const rejected: RejectedVerb[] = [];
  for (const verb of raw) {
    const issues = validateVerb(verb);
    if (issues.length === 0) valid.push(verb as Verb);
    else rejected.push({ verb, issues });
  }
  return { valid, rejected };
}

const RULE_SOURCE_FIELDS = ['book', 'edition', 'section', 'page'];

// id правил и соглашений без заполненного основного источника
export function validateParadigm(p: Paradigm = defaultParadigm): string[] {
  return [...p.rules, ...p.conventions]
    .filter((e) => !hasFilledPrimary(e.sources, RULE_SOURCE_FIELDS))
    .map((e) => e.id);
}
