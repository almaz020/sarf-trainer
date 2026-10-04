import type { PronounId, Verb } from '../engine/paradigm';
import type { AttemptResult } from './attempt';
import { shuffleLetters } from './shuffle';

// Канонический набор девяти местоимений (ТЗ п. 4); порядок заданий случайный (п. 17).
export const PRONOUN_ORDER: PronounId[] = ['hum', 'hiya', 'hunna', 'anta', 'antum', 'anti', 'antunna', 'ana', 'nahnu'];

export interface Counter {
  first: number;
  second: number;
  failed: number;
}

export const emptyCounter: Counter = { first: 0, second: 0, failed: 0 };

export function addResult(counter: Counter, result: AttemptResult): Counter {
  switch (result) {
    case 'first':
      return { ...counter, first: counter.first + 1 };
    case 'second':
      return { ...counter, second: counter.second + 1 };
    case 'failed':
      return { ...counter, failed: counter.failed + 1 };
  }
}

// Случайный глагол; не тот же подряд, если глаголов больше одного (сравнение по ссылке).
export function pickVerb(verbs: Verb[], previous: Verb | null, random: () => number): Verb {
  const pool = verbs.length > 1 && previous !== null ? verbs.filter((v) => v !== previous) : verbs;
  return pool[Math.min(Math.floor(random() * pool.length), pool.length - 1)];
}

// Случайная перестановка девяти местоимений; первый элемент не равен avoidFirst.
export function shufflePronouns(random: () => number, avoidFirst?: PronounId): PronounId[] {
  const order = shuffleLetters(PRONOUN_ORDER, random);
  if (avoidFirst !== undefined && order[0] === avoidFirst) {
    const last = order.length - 1;
    [order[0], order[last]] = [order[last], order[0]];
  }
  return order;
}

export interface SessionState {
  verb: Verb;
  index: number;
  order: PronounId[];
  counter: Counter;
}

export function startSession(verbs: Verb[], random: () => number, avoidFirst?: PronounId): SessionState {
  const verb = pickVerb(verbs, null, random);
  return { verb, index: 0, order: shufflePronouns(random, avoidFirst), counter: emptyCounter };
}

export function nextTask(state: SessionState, verbs: Verb[], random: () => number): SessionState {
  if (state.index + 1 < state.order.length) return { ...state, index: state.index + 1 };
  const verb = pickVerb(verbs, state.verb, random);
  return { ...state, verb, index: 0, order: shufflePronouns(random, state.order[state.order.length - 1]) };
}

// Ручной выбор глагола: новая перестановка (первое не равно текущему), счётчик сохраняется.
export function selectVerb(state: SessionState, verb: Verb, random: () => number): SessionState {
  return { ...state, verb, index: 0, order: shufflePronouns(random, currentPronoun(state)) };
}

export function currentPronoun(state: SessionState): PronounId {
  return state.order[state.index];
}
