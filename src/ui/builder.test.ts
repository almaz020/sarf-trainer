import { describe, expect, it } from 'vitest';
import { builderReducer, emptyState, type BuilderAction, type BuilderState } from './builder';

const run = (actions: BuilderAction[], from: BuilderState = emptyState) => actions.reduce(builderReducer, from);
const add = (letter: string): BuilderAction => ({ type: 'addLetter', letter });

describe('builderReducer', () => {
  it('буква добавляет слот в конец и выбирает его', () => {
    const s = run([add('ن'), add('ص')]);
    expect(s.slots).toEqual([
      { letter: 'ن', shadda: false, haraka: null },
      { letter: 'ص', shadda: false, haraka: null },
    ]);
    expect(s.selected).toBe(1);
  });

  it('нажатие на плитку выбирает её; индекс вне диапазона игнорируется', () => {
    const s = run([add('ن'), add('ص'), { type: 'select', index: 0 }]);
    expect(s.selected).toBe(0);
    expect(builderReducer(s, { type: 'select', index: 5 })).toBe(s);
    expect(builderReducer(s, { type: 'select', index: -1 })).toBe(s);
  });

  it('огласовка ставится на выбранный слот и заменяет прежнюю', () => {
    const s = run([add('ن'), { type: 'setHaraka', haraka: 'fatha' }, { type: 'setHaraka', haraka: 'kasra' }]);
    expect(s.slots[0].haraka).toBe('kasra');
  });

  it('повторное нажатие той же огласовки снимает её', () => {
    const s = run([add('ن'), { type: 'setHaraka', haraka: 'sukun' }, { type: 'setHaraka', haraka: 'sukun' }]);
    expect(s.slots[0].haraka).toBeNull();
  });

  it('огласовка меняет только выбранный слот', () => {
    let s = run([add('ن'), { type: 'setHaraka', haraka: 'fatha' }, add('ص'), { type: 'setHaraka', haraka: 'kasra' }]);
    expect(s.slots.map((x) => x.haraka)).toEqual(['fatha', 'kasra']);
    s = run([{ type: 'select', index: 0 }, { type: 'setHaraka', haraka: 'damma' }], s);
    expect(s.slots.map((x) => x.haraka)).toEqual(['damma', 'kasra']);
  });

  it('шадда переключается независимо от огласовки', () => {
    let s = run([add('ن'), { type: 'setHaraka', haraka: 'fatha' }, { type: 'toggleShadda' }]);
    expect(s.slots[0]).toEqual({ letter: 'ن', shadda: true, haraka: 'fatha' });
    s = builderReducer(s, { type: 'setHaraka', haraka: 'damma' });
    expect(s.slots[0]).toEqual({ letter: 'ن', shadda: true, haraka: 'damma' });
    s = builderReducer(s, { type: 'toggleShadda' });
    expect(s.slots[0]).toEqual({ letter: 'ن', shadda: false, haraka: 'damma' });
  });

  it('«убрать знак» снимает и огласовку, и шадду', () => {
    const s = run([add('ن'), { type: 'setHaraka', haraka: 'fatha' }, { type: 'toggleShadda' }, { type: 'clearMarks' }]);
    expect(s.slots[0]).toEqual({ letter: 'ن', shadda: false, haraka: null });
  });

  it('знаки без выбранного слота ничего не делают', () => {
    expect(builderReducer(emptyState, { type: 'setHaraka', haraka: 'fatha' })).toBe(emptyState);
    expect(builderReducer(emptyState, { type: 'toggleShadda' })).toBe(emptyState);
    expect(builderReducer(emptyState, { type: 'clearMarks' })).toBe(emptyState);
  });

  it('«Стереть последнюю»: выбирается новый последний; если слотов нет, выбора нет', () => {
    let s = run([add('ن'), add('ص'), add('ر'), { type: 'select', index: 0 }, { type: 'eraseLast' }]);
    expect(s.slots.map((x) => x.letter)).toEqual(['ن', 'ص']);
    expect(s.selected).toBe(1);
    s = run([{ type: 'eraseLast' }, { type: 'eraseLast' }], s);
    expect(s).toEqual(emptyState);
    expect(builderReducer(emptyState, { type: 'eraseLast' })).toEqual(emptyState);
  });

  it('«Очистить»', () => {
    expect(run([add('ن'), add('ص'), { type: 'clearAll' }])).toEqual(emptyState);
  });

  it('не мутирует предыдущее состояние', () => {
    const before = run([add('ن')]);
    const snapshot = JSON.stringify(before);
    builderReducer(before, { type: 'setHaraka', haraka: 'fatha' });
    builderReducer(before, { type: 'toggleShadda' });
    builderReducer(before, { type: 'addLetter', letter: 'ص' });
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});
