// Буквы, допустимые в корне глагола формы I (ТЗ п. 16), по алфавиту.
export const ARABIC_KEYS: string[] = Array.from('بتثجحخدذرزسشصضطظعغفقكلمنه');

export type KeyAction = { type: 'letter'; letter: string } | { type: 'backspace' } | { type: 'clear' };

export function applyKey(query: string, action: KeyAction): string {
  switch (action.type) {
    case 'letter':
      return query + action.letter;
    case 'backspace':
      return Array.from(query).slice(0, -1).join('');
    case 'clear':
      return '';
  }
}
