import { describe, expect, it } from 'vitest';
import type { Haraka, Slot } from '../engine/slots';
import { check, initialAttempt, lettersEqual, resultOf } from './attempt';

const s = (letter: string, haraka: Haraka | null, shadda = false): Slot => ({ letter, shadda, haraka });
const antum: Slot[] = [s('ن', 'fatha'), s('ص', 'fatha'), s('ر', 'sukun'), s('ت', 'damma'), s('م', 'sukun')];
const noFinalSukun: Slot[] = [s('ن', 'fatha'), s('ص', 'fatha'), s('ر', 'sukun'), s('ت', 'damma'), s('م', null)];

describe('check', () => {
  it('верно с 1-й попытки', () => {
    const st = check(initialAttempt, antum, antum);
    expect(st).toEqual({ phase: 'solved', attempt: 1 });
    expect(resultOf(st)).toBe('first');
  });

  it('неверно с 1-й попытки: красная индикация, 2-я попытка', () => {
    const st = check(initialAttempt, noFinalSukun, antum);
    expect(st).toEqual({ phase: 'answering', attempt: 2, wrong: true });
    expect(resultOf(st)).toBeNull();
  });

  it('верно со 2-й попытки', () => {
    const st = check(check(initialAttempt, noFinalSukun, antum), antum, antum);
    expect(st).toEqual({ phase: 'solved', attempt: 2 });
    expect(resultOf(st)).toBe('second');
  });

  it('неверно во 2-й попытке: показан правильный ответ', () => {
    const st = check(check(initialAttempt, noFinalSukun, antum), noFinalSukun, antum);
    expect(st).toEqual({ phase: 'revealed' });
    expect(resultOf(st)).toBe('failed');
  });

  it('пустой ответ не засчитывается и не тратит попытку', () => {
    expect(check(initialAttempt, [], antum)).toBe(initialAttempt);
  });

  it('после верного ответа и после показа ответа повторная проверка ничего не меняет', () => {
    const solved = check(initialAttempt, antum, antum);
    expect(check(solved, noFinalSukun, antum)).toBe(solved);
    const revealed = check(check(initialAttempt, noFinalSukun, antum), noFinalSukun, antum);
    expect(check(revealed, antum, antum)).toBe(revealed);
  });

  it('отличие в один знак не засчитывается', () => {
    const wrongShadda = antum.map((x, i) => (i === 3 ? { ...x, shadda: true } : x));
    const wrongHaraka = antum.map((x, i) => (i === 3 ? { ...x, haraka: 'kasra' as Haraka } : x));
    expect(check(initialAttempt, wrongShadda, antum).phase).toBe('answering');
    expect(check(initialAttempt, wrongHaraka, antum).phase).toBe('answering');
  });
});

describe('lettersEqual', () => {
  it('равные буквы при разных знаках: true', () => {
    expect(lettersEqual(antum, noFinalSukun)).toBe(true);
    expect(lettersEqual(antum, antum.map((x) => ({ ...x, haraka: null, shadda: true })))).toBe(true);
  });

  it('другая буква, другой порядок, другая длина: false', () => {
    expect(lettersEqual(antum, antum.map((x, i) => (i === 4 ? { ...x, letter: 'ن' } : x)))).toBe(false);
    expect(lettersEqual(antum, [...antum].reverse())).toBe(false);
    expect(lettersEqual(antum, antum.slice(0, 4))).toBe(false);
    expect(lettersEqual(antum, [...antum, s('ا', null)])).toBe(false);
  });
});

describe('check: режим plain', () => {
  const lettersOnly: Slot[] = antum.map((x) => ({ letter: x.letter, shadda: false, haraka: null }));
  const wrongLetter: Slot[] = antum.map((x, i) => (i === 4 ? { ...x, letter: 'ن' } : x));

  it('верно при совпадении букв независимо от знаков', () => {
    expect(check(initialAttempt, lettersOnly, antum, 'plain')).toEqual({ phase: 'solved', attempt: 1 });
    expect(check(initialAttempt, noFinalSukun, antum, 'plain')).toEqual({ phase: 'solved', attempt: 1 });
  });

  it('неверно при другой букве; вторая ошибка: revealed', () => {
    const st = check(initialAttempt, wrongLetter, antum, 'plain');
    expect(st).toEqual({ phase: 'answering', attempt: 2, wrong: true });
    expect(check(st, wrongLetter, antum, 'plain')).toEqual({ phase: 'revealed' });
  });

  it('в vowelled (и без аргумента mode) отличие в один знак не засчитывается', () => {
    expect(check(initialAttempt, lettersOnly, antum, 'vowelled').phase).toBe('answering');
    expect(check(initialAttempt, lettersOnly, antum).phase).toBe('answering');
  });
});
