import type { PronounId } from '../engine/paradigm';
import { stripMarks } from './plain';

// Арабские названия и описания: ТЗ п. 4. Знаки записаны через \uXXXX; шадда перед огласовкой.
export const PRONOUNS: Record<PronounId, { arabic: string; description: string }> = {
  hum: { arabic: '\u0647\u064f\u0645\u0652', description: '3 л., м. р., мн. ч.' },
  hiya: { arabic: '\u0647\u0650\u064a\u064e', description: '3 л., ж. р., ед. ч.' },
  hunna: { arabic: '\u0647\u064f\u0646\u0651\u064e', description: '3 л., ж. р., мн. ч.' },
  anta: { arabic: '\u0623\u064e\u0646\u0652\u062a\u064e', description: '2 л., м. р., ед. ч.' },
  antum: { arabic: '\u0623\u064e\u0646\u0652\u062a\u064f\u0645\u0652', description: '2 л., м. р., мн. ч.' },
  anti: { arabic: '\u0623\u064e\u0646\u0652\u062a\u0650', description: '2 л., ж. р., ед. ч.' },
  antunna: { arabic: '\u0623\u064e\u0646\u0652\u062a\u064f\u0646\u0651\u064e', description: '2 л., ж. р., мн. ч.' },
  ana: { arabic: '\u0623\u064e\u0646\u064e\u0627', description: '1 л., ед. ч.' },
  nahnu: { arabic: '\u0646\u064e\u062d\u0652\u0646\u064f', description: '1 л., мн. ч.' },
};

// Текст местоимения; в режиме без огласовок anti сохраняет кясру под ت (ТЗ п. 17).
export function pronounText(pronoun: PronounId, plain: boolean): string {
  if (!plain) return PRONOUNS[pronoun].arabic;
  if (pronoun === 'anti') return '\u0623\u0646\u062a\u0650';
  return stripMarks(PRONOUNS[pronoun].arabic);
}
