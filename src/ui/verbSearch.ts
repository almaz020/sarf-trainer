import { conjugatePast } from '../engine/conjugate';
import type { Verb } from '../engine/paradigm';
import { slotsToString } from '../engine/slots';

// Убирает знаки U+064B-U+0652 и татвиль U+0640, обрезает пробелы по краям; буквы не меняет.
export function normalizeArabic(text: string): string {
  return text.replace(/[\u064b-\u0652\u0640]/g, '').trim();
}

// Исходная форма هو без знаков.
export function verbForm(verb: Verb): string {
  return normalizeArabic(slotsToString(conjugatePast(verb, 'huwa')));
}

// Подстрока корня или формы هو, без учёта знаков; пустой запрос: все глаголы; порядок сохраняется.
export function searchVerbs(verbs: Verb[], query: string): Verb[] {
  const q = normalizeArabic(query);
  if (q === '') return [...verbs];
  return verbs.filter((v) => normalizeArabic(v.root.join('')).includes(q) || verbForm(v).includes(q));
}
