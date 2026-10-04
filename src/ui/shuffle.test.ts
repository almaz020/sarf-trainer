import { describe, expect, it } from 'vitest';
import { shuffleLetters as shuffle } from './shuffle';

const seq = (values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe('shuffle', () => {
  it('не мутирует вход и возвращает новый массив', () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffle(input, () => 0.3);
    expect(input).toEqual([1, 2, 3, 4, 5]);
    expect(out).not.toBe(input);
  });

  it('сохраняет множество элементов', () => {
    const input = ['a', 'b', 'c', 'd', 'e', 'f'];
    for (const r of [0, 0.2, 0.5, 0.99]) {
      expect([...shuffle(input, () => r)].sort()).toEqual([...input].sort());
    }
  });

  it('зависит от random: разные random дают разный порядок', () => {
    const input = [1, 2, 3, 4, 5, 6];
    expect(shuffle(input, () => 0)).not.toEqual(shuffle(input, () => 0.99));
    expect(shuffle(input, seq([0.1, 0.7, 0.4, 0.9, 0.2]))).not.toEqual(shuffle(input, seq([0.8, 0.3, 0.6, 0.1, 0.5])));
  });

  it('random=()=>0 даёт детерминированный результат (сдвиг влево на 1)', () => {
    expect(shuffle([1, 2, 3, 4], () => 0)).toEqual([2, 3, 4, 1]);
    expect(shuffle([1, 2, 3, 4], () => 0)).toEqual(shuffle([1, 2, 3, 4], () => 0));
  });

  it('random, близкий к 1, не выходит за границы', () => {
    expect([...shuffle([1, 2, 3], () => 0.9999999)].sort()).toEqual([1, 2, 3]);
  });

  it('пустой и одноэлементный массивы', () => {
    expect(shuffle([], () => 0.5)).toEqual([]);
    expect(shuffle([7], () => 0.5)).toEqual([7]);
  });

  it('Fisher-Yates, а не Саттоло: random близкий к 1 даёт тождественную перестановку', () => {
    expect(shuffle([1, 2, 3], () => 0.9999999)).toEqual([1, 2, 3]);
    expect(shuffle([1, 2, 3, 4, 5], () => 0.9999999)).toEqual([1, 2, 3, 4, 5]);
  });

  it('серия фиксированных значений даёт ожидаемые перестановки (все 6 для трёх элементов достижимы)', () => {
    const seen = new Set<string>();
    for (const r1 of [0, 0.5, 0.99]) {
      for (const r2 of [0, 0.99]) seen.add(shuffle([1, 2, 3], seq([r1, r2])).join(''));
    }
    expect([...seen].sort()).toEqual(['123', '132', '213', '231', '312', '321']);
    expect(shuffle([1, 2, 3], seq([0.5, 0]))).toEqual([3, 1, 2]);
  });
});
