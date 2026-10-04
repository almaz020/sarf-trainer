import type { Haraka, Slot } from '../engine/slots';

export interface BuilderState {
  slots: Slot[];
  selected: number | null;
}

export const emptyState: BuilderState = { slots: [], selected: null };

export type BuilderAction =
  | { type: 'addLetter'; letter: string }
  | { type: 'select'; index: number }
  | { type: 'setHaraka'; haraka: Haraka }
  | { type: 'toggleShadda' }
  | { type: 'clearMarks' }
  | { type: 'eraseLast' }
  | { type: 'clearAll' };

function updateSelected(state: BuilderState, fn: (s: Slot) => Slot): BuilderState {
  if (state.selected === null) return state;
  return { ...state, slots: state.slots.map((s, i) => (i === state.selected ? fn(s) : s)) };
}

export function builderReducer(state: BuilderState, action: BuilderAction): BuilderState {
  switch (action.type) {
    case 'addLetter': {
      const slots = [...state.slots, { letter: action.letter, shadda: false, haraka: null }];
      return { slots, selected: slots.length - 1 };
    }
    case 'select':
      return action.index >= 0 && action.index < state.slots.length ? { ...state, selected: action.index } : state;
    case 'setHaraka':
      return updateSelected(state, (s) => ({ ...s, haraka: s.haraka === action.haraka ? null : action.haraka }));
    case 'toggleShadda':
      return updateSelected(state, (s) => ({ ...s, shadda: !s.shadda }));
    case 'clearMarks':
      return updateSelected(state, (s) => ({ ...s, shadda: false, haraka: null }));
    case 'eraseLast': {
      const slots = state.slots.slice(0, -1);
      return { slots, selected: slots.length > 0 ? slots.length - 1 : null };
    }
    case 'clearAll':
      return emptyState;
  }
}
