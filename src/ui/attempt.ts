import { slotsEqual, type Slot } from '../engine/slots';

export type AttemptState =
  | { phase: 'answering'; attempt: 1 | 2; wrong: boolean }
  | { phase: 'solved'; attempt: 1 | 2 }
  | { phase: 'revealed' };

export type AttemptResult = 'first' | 'second' | 'failed';

export type Mode = 'vowelled' | 'plain';

export const initialAttempt: AttemptState = { phase: 'answering', attempt: 1, wrong: false };

// Сравнение только состава и порядка букв (режим «без огласовок»).
export function lettersEqual(a: Slot[], b: Slot[]): boolean {
  return a.length === b.length && a.every((slot, i) => slot.letter === b[i].letter);
}

// vowelled: slotsEqual; plain: lettersEqual. Пустой ответ и повторная проверка после финала не меняют состояние.
export function check(state: AttemptState, answer: Slot[], expected: Slot[], mode: Mode = 'vowelled'): AttemptState {
  if (state.phase !== 'answering' || answer.length === 0) return state;
  const equal = mode === 'plain' ? lettersEqual : slotsEqual;
  if (equal(answer, expected)) return { phase: 'solved', attempt: state.attempt };
  return state.attempt === 1 ? { phase: 'answering', attempt: 2, wrong: true } : { phase: 'revealed' };
}

export function resultOf(state: AttemptState): AttemptResult | null {
  if (state.phase === 'solved') return state.attempt === 1 ? 'first' : 'second';
  if (state.phase === 'revealed') return 'failed';
  return null;
}
