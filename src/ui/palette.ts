import { ARABIC_KEYS } from './keyboard';
import { shuffleLetters } from './shuffle';

export const EXTRA_COUNT = 5;
export const BASE_EXTRA = ['ت', 'ن', 'و', 'ا', 'م'];

// Палитра букв: обязательные (корень + BASE_EXTRA) и extraCount лишних из ARABIC_KEYS, всё вразнобой (ТЗ п. 18).
export function buildPalette(root: string[], random: () => number, extraCount = EXTRA_COUNT): string[] {
  const required = [...new Set([...root, ...BASE_EXTRA])];
  const pool = ARABIC_KEYS.filter((l) => !required.includes(l));
  const extras = shuffleLetters(pool, random).slice(0, Math.max(0, extraCount));
  return shuffleLetters([...required, ...extras], random);
}
