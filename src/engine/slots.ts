export type Haraka = 'fatha' | 'damma' | 'kasra' | 'sukun';

export interface Slot {
  letter: string;
  shadda: boolean;
  haraka: Haraka | null;
}

const SHADDA = '\u0651';
const HARAKA_CHAR: Record<Haraka, string> = {
  fatha: '\u064E',
  damma: '\u064F',
  kasra: '\u0650',
  sukun: '\u0652',
};

// Порядок символов: буква → шадда → огласовка (ТЗ п. 6). Нормализация NFC не применяется.
export function slotsToString(slots: Slot[]): string {
  return slots
    .map((s) => s.letter + (s.shadda ? SHADDA : '') + (s.haraka ? HARAKA_CHAR[s.haraka] : ''))
    .join('');
}

export function slotsEqual(a: Slot[], b: Slot[]): boolean {
  return (
    a.length === b.length &&
    a.every((s, i) => s.letter === b[i].letter && s.shadda === b[i].shadda && s.haraka === b[i].haraka)
  );
}
