// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { conjugatePast } from '../engine/conjugate';
import type { PronounId, Verb } from '../engine/paradigm';
import { slotsToString, type Slot } from '../engine/slots';
import { ADVANCE_DELAY_MS, App } from './App';
import { demoRuleSources, demoVerb, demoVerbs } from './demo';
import { stripMarks } from './plain';
import { PRONOUNS, pronounText as pronounView } from './pronouns';
import { PRONOUN_ORDER, shufflePronouns } from './session';
import { shuffleLetters } from './shuffle';
import { defaultPersisted, type Persisted, type Store } from './storage';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute('data-theme');
  try {
    window.localStorage.clear();
  } catch {
    /* нет хранилища */
  }
});

function fakeStore(initial: Partial<Persisted> = {}) {
  let data: Persisted = { ...defaultPersisted, ...initial };
  const saves: Persisted[] = [];
  const store: Store = {
    load: () => data,
    save: (p) => {
      data = p;
      saves.push(p);
    },
    clearProgress: () => {
      data = { ...data, counter: { first: 0, second: 0, failed: 0 } };
      return data;
    },
  };
  return { store, get data() { return data; }, saves };
}

const rules = () => demoRuleSources;
const first = () => 0;
// Порядок местоимений при random=()=>0 (сдвиг: hiya, hunna, …, nahnu, hum).
const ORD = shufflePronouns(first);
// Порядок после ручного выбора/сброса из начального состояния: первое не равно прежнему ORD[0].
const ORD2 = shufflePronouns(first, ORD[0]);
// Простой детерминированный генератор для проверок с «настоящей» перестановкой.
const lcg = (seed: number) => {
  let st = seed;
  return () => {
    st = (st * 1664525 + 1013904223) % 4294967296;
    return st / 4294967296;
  };
};

describe('App: гейты', () => {
  it('у правил нет ссылок: тренировка не запускается, показаны id правил', () => {
    render(<App verbs={[demoVerb]} missingRuleSources={['huwa', 'stem']} ruleSourcesFor={rules} />);
    expect(screen.queryByTestId('trainer')).toBeNull();
    const list = screen.getByTestId('gate-sources').textContent ?? '';
    expect(list).toContain('huwa');
    expect(list).toContain('stem');
    expect(screen.queryByTestId('gate-verbs')).toBeNull();
  });

  it('нет проверенных глаголов: сообщение из ТЗ', () => {
    render(<App verbs={[]} missingRuleSources={[]} ruleSourcesFor={rules} />);
    expect(screen.queryByTestId('trainer')).toBeNull();
    expect(screen.getByTestId('gate-verbs').textContent).toBe('Нет проверенных глаголов в verbs.json');
  });

  it('оба условия: показаны оба сообщения', () => {
    render(<App verbs={[]} missingRuleSources={['huwa']} ruleSourcesFor={rules} />);
    expect(screen.getByTestId('gate-sources')).toBeTruthy();
    expect(screen.getByTestId('gate-verbs')).toBeTruthy();
  });

  it('при гейте счётчика нет', () => {
    render(<App verbs={[]} missingRuleSources={['huwa']} ruleSourcesFor={rules} />);
    expect(screen.queryByTestId('counter')).toBeNull();
  });
});

type User = ReturnType<typeof userEvent.setup>;
const click = (user: User, testId: string) => user.click(screen.getByTestId(testId));
const check = (user: User) => user.click(screen.getByRole('button', { name: 'Проверить' }));
const next = (user: User) => user.click(screen.getByRole('button', { name: 'Дальше' }));

async function build(user: User, slots: Slot[]) {
  for (const s of slots) {
    await click(user, `letter-${s.letter}`);
    if (s.haraka) await click(user, `mark-${s.haraka}`);
    if (s.shadda) await click(user, 'mark-shadda');
  }
}
async function solve(user: User, verb: Verb, pronoun: PronounId) {
  await build(user, conjugatePast(verb, pronoun));
  await check(user);
}
async function failTwice(user: User) {
  await click(user, 'letter-ن');
  await check(user);
  await check(user);
}
const advance = (ms: number) =>
  act(async () => {
    vi.advanceTimersByTime(ms);
  });
// Текущее местоимение на экране (в любом режиме) -> id.
const currentId = (): PronounId => {
  const text = screen.getByTestId('pronoun').textContent;
  const found = PRONOUN_ORDER.find((id) => pronounView(id, false) === text || pronounView(id, true) === text);
  if (!found) throw new Error(`неизвестное местоимение на экране: ${text}`);
  return found;
};
const pronounText = () => screen.getByTestId('pronoun').textContent;
const verbForm = () => screen.getByTestId('verb-form').textContent;
const counterText = () => screen.getByTestId('counter').textContent;
const huwa = (v: Verb) => slotsToString(conjugatePast(v, 'huwa'));

describe('App: ход тренировки', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // RTL распознаёт fake timers по глобальному jest; в vitest его нет, и asyncWrapper зависает.
    vi.stubGlobal('jest', { advanceTimersByTime: vi.advanceTimersByTime.bind(vi) });
  });
  const setup = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

  it('начало: случайный глагол, первое задание из перестановки, счётчик нулевой', () => {
    render(<App verbs={demoVerbs} missingRuleSources={[]} ruleSourcesFor={rules} random={() => 0.99} />);
    expect(verbForm()).toBe(huwa(demoVerbs[2]));
    expect(pronounText()).toBe(PRONOUNS[shufflePronouns(() => 0.99)[0]].arabic);
    expect(counterText()).toBe('С 1-й попытки: 0 · Со 2-й: 0 · Не решено: 0');
  });

  it('верно с 1-й попытки: счётчик сразу, до 1000 мс то же задание со ссылкой на правило, затем следующее', async () => {
    const user = setup();
    const ruleSourcesFor = vi.fn((_p: PronounId) => demoRuleSources);
    render(<App verbs={[demoVerb]} missingRuleSources={[]} ruleSourcesFor={ruleSourcesFor} random={first} />);
    await solve(user, demoVerb, ORD[0]);
    expect(counterText()).toBe('С 1-й попытки: 1 · Со 2-й: 0 · Не решено: 0');
    expect(screen.getByTestId('rule-ref')).toBeTruthy();
    await advance(ADVANCE_DELAY_MS - 1);
    expect(pronounText()).toBe(PRONOUNS[ORD[0]].arabic);
    expect(screen.getByTestId('rule-ref')).toBeTruthy();
    await advance(1);
    expect(pronounText()).toBe(PRONOUNS[ORD[1]].arabic);
    expect(screen.queryAllByTestId('tile')).toHaveLength(0);
    expect(screen.queryByTestId('rule-ref')).toBeNull();
    expect(counterText()).toBe('С 1-й попытки: 1 · Со 2-й: 0 · Не решено: 0');
    expect(ruleSourcesFor).toHaveBeenLastCalledWith(ORD[1]);
  });

  it('верно со 2-й попытки: счётчик «Со 2-й»', async () => {
    const user = setup();
    render(<App verbs={[demoVerb]} missingRuleSources={[]} ruleSourcesFor={rules} random={first} />);
    await click(user, 'letter-ن');
    await check(user);
    await user.click(screen.getByRole('button', { name: 'Очистить' }));
    await solve(user, demoVerb, ORD[0]);
    expect(counterText()).toBe('С 1-й попытки: 0 · Со 2-й: 1 · Не решено: 0');
    await advance(ADVANCE_DELAY_MS);
    expect(pronounText()).toBe(PRONOUNS[ORD[1]].arabic);
    expect(counterText()).toBe('С 1-й попытки: 0 · Со 2-й: 1 · Не решено: 0');
  });

  it('не решено: счётчик сразу, автоперехода нет даже через 5 с, переход только по «Дальше»', async () => {
    const user = setup();
    render(<App verbs={[demoVerb]} missingRuleSources={[]} ruleSourcesFor={rules} random={first} />);
    await failTwice(user);
    expect(counterText()).toBe('С 1-й попытки: 0 · Со 2-й: 0 · Не решено: 1');
    await advance(5000);
    expect(pronounText()).toBe(PRONOUNS[ORD[0]].arabic);
    expect(screen.getByTestId('correct').textContent).toBe(slotsToString(conjugatePast(demoVerb, ORD[0])));
    await next(user);
    expect(pronounText()).toBe(PRONOUNS[ORD[1]].arabic);
    expect(screen.queryAllByTestId('tile')).toHaveLength(0);
    expect(screen.getByTestId('trainer').getAttribute('data-status')).toBe('idle');
    expect(counterText()).toBe('С 1-й попытки: 0 · Со 2-й: 0 · Не решено: 1');
  });

  it('счётчик копится между заданиями, каждый результат считается один раз', async () => {
    const user = setup();
    render(<App verbs={[demoVerb]} missingRuleSources={[]} ruleSourcesFor={rules} random={first} />);
    await solve(user, demoVerb, ORD[0]);
    await advance(ADVANCE_DELAY_MS);
    await failTwice(user);
    await next(user);
    expect(counterText()).toBe('С 1-й попытки: 1 · Со 2-й: 0 · Не решено: 1');
    await advance(3000);
    expect(counterText()).toBe('С 1-й попытки: 1 · Со 2-й: 0 · Не решено: 1');
    expect(pronounText()).toBe(PRONOUNS[ORD[2]].arabic);
  });

  it('9 заданий по глаголу идут по перестановке (все 9 по разу), затем другой глагол и новая перестановка', async () => {
    const user = setup();
    render(<App verbs={[demoVerbs[0], demoVerbs[1]]} missingRuleSources={[]} ruleSourcesFor={rules} random={first} />);
    expect(verbForm()).toBe(huwa(demoVerbs[0]));
    const seen: (string | null)[] = [];
    for (let i = 0; i < PRONOUN_ORDER.length; i++) {
      seen.push(pronounText());
      expect(verbForm()).toBe(huwa(demoVerbs[0]));
      await failTwice(user);
      await next(user);
    }
    expect(seen).toEqual(ORD.map((p) => PRONOUNS[p].arabic));
    expect(new Set(seen).size).toBe(9);
    expect(verbForm()).toBe(huwa(demoVerbs[1]));
    expect(pronounText()).not.toBe(seen[8]);
    expect(counterText()).toBe('С 1-й попытки: 0 · Со 2-й: 0 · Не решено: 9');
  });

  it('со случайной перестановкой: каждое местоимение по разу, на стыке глаголов первое не равно последнему', async () => {
    const user = setup();
    render(<App verbs={[demoVerbs[0], demoVerbs[1]]} missingRuleSources={[]} ruleSourcesFor={rules} random={lcg(5)} />);
    const verb0 = verbForm();
    for (let round = 0; round < 3; round++) {
      const ids: PronounId[] = [];
      const verb = verbForm();
      for (let i = 0; i < PRONOUN_ORDER.length; i++) {
        ids.push(currentId());
        expect(verbForm()).toBe(verb);
        await failTwice(user);
        await next(user);
      }
      expect([...ids].sort()).toEqual([...PRONOUN_ORDER].sort());
      expect(verbForm()).not.toBe(verb);
      expect(currentId()).not.toBe(ids[8]);
    }
    expect(verb0).toBeTruthy();
  });

  it('автопереход и «Дальше» идут по текущей перестановке (решение по currentId)', async () => {
    const user = setup();
    render(<App verbs={[demoVerbs[0], demoVerbs[1]]} missingRuleSources={[]} ruleSourcesFor={rules} random={lcg(9)} />);
    const verb = demoVerbs[0];
    const ids: PronounId[] = [];
    for (let i = 0; i < 4; i++) {
      const id = currentId();
      ids.push(id);
      await solve(user, verbForm() === huwa(verb) ? verb : demoVerbs[1], id);
      await advance(ADVANCE_DELAY_MS);
    }
    for (let i = 0; i < 2; i++) {
      ids.push(currentId());
      await failTwice(user);
      await next(user);
    }
    expect(new Set(ids).size).toBe(6);
    expect(counterText()).toBe('С 1-й попытки: 4 · Со 2-й: 0 · Не решено: 2');
  });

  it('с одним проверенным глаголом сессия продолжается тем же глаголом с новой перестановкой', async () => {
    const user = setup();
    render(<App verbs={[demoVerb]} missingRuleSources={[]} ruleSourcesFor={rules} random={first} />);
    for (let i = 0; i < PRONOUN_ORDER.length; i++) {
      await failTwice(user);
      await next(user);
    }
    expect(verbForm()).toBe(huwa(demoVerb));
    expect(pronounText()).not.toBe(PRONOUNS[ORD[8]].arabic);
  });

  it('таймер автоперехода снимается при размонтировании', async () => {
    const user = setup();
    const { unmount } = render(<App verbs={[demoVerb]} missingRuleSources={[]} ruleSourcesFor={rules} random={first} />);
    await solve(user, demoVerb, ORD[0]);
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  describe('режим без огласовок', () => {
    const MARKS_RE = /[\u064b-\u0652]/;
    const marks = () => screen.queryAllByTestId(/^mark-/);
    const markSection = () => marks()[0].closest('.marks') as HTMLElement;
    const expectMarksHidden = () => {
      expect(marks().length).toBeGreaterThan(0);
      const sec = markSection();
      expect(sec.classList.contains('is-hidden')).toBe(true);
      expect(sec.getAttribute('aria-hidden')).toBe('true');
      expect(marks().every((b) => (b as HTMLButtonElement).disabled)).toBe(true);
    };
    const expectMarksShown = () => {
      expect(marks().length).toBeGreaterThan(0);
      const sec = markSection();
      expect(sec.classList.contains('is-hidden')).toBe(false);
      expect(sec.hasAttribute('aria-hidden')).toBe(false);
      expect(marks().every((b) => !(b as HTMLButtonElement).disabled)).toBe(true);
    };
    const pressed = (id: string) => screen.getByTestId(id).getAttribute('aria-pressed');
    const mount = () =>
      render(<App verbs={[demoVerb]} missingRuleSources={[]} ruleSourcesFor={rules} random={first} />);

    it('по умолчанию выбран «С огласовками», палитра знаков есть', () => {
      mount();
      expect(pressed('mode-vowelled')).toBe('true');
      expect(pressed('mode-plain')).toBe('false');
      expect(screen.getByTestId('mode-vowelled').textContent).toBe('С огласовками');
      expect(screen.getByTestId('mode-plain').textContent).toBe('Без огласовок');
      expect(screen.getByTestId('mode-toggle').contains(screen.getByTestId('mode-plain'))).toBe(true);
      expectMarksShown();
    });

    const stripped = (verb: Verb, p: PronounId) =>
      conjugatePast(verb, p).map((s) => ({ ...s, haraka: null, shadda: false }));
    const first1 = 'С 1-й попытки: 1 · Со 2-й: 0 · Не решено: 0';

    it('клик «Без огласовок» сразу в первом задании: палитра скрыта, هو и местоимение без знаков', async () => {
      const user = setup();
      mount();
      expectMarksShown();
      expect(verbForm()).toMatch(MARKS_RE);
      await click(user, 'mode-plain');
      expect(pressed('mode-plain')).toBe('true');
      expect(pressed('mode-vowelled')).toBe('false');
      expectMarksHidden();
      expect(verbForm()).toBe(stripMarks(huwa(demoVerb)));
      expect(verbForm()).not.toMatch(MARKS_RE);
      expect(pronounText()).toBe(pronounView(ORD[0], true));
      expect(pronounText()).not.toMatch(MARKS_RE);
    });

    it('сразу после переключения ответ из букв засчитывается в этом же задании с 1-й попытки', async () => {
      const user = setup();
      mount();
      await click(user, 'mode-plain');
      await build(user, stripped(demoVerb, ORD[0]));
      await check(user);
      expect(counterText()).toBe(first1);
      expect(pronounText()).toBe(pronounView(ORD[0], true));
    });

    it('набранный с огласовками ответ сохраняется при переключении; проверка по буквам верна', async () => {
      const user = setup();
      mount();
      await build(user, conjugatePast(demoVerb, ORD[0]));
      const count = screen.getAllByTestId('tile').length;
      expect(screen.getAllByTestId('tile').some((t) => MARKS_RE.test(t.textContent ?? ''))).toBe(true);
      await click(user, 'mode-plain');
      const tiles = screen.getAllByTestId('tile');
      expect(tiles).toHaveLength(count);
      expect(tiles.some((t) => MARKS_RE.test(t.textContent ?? ''))).toBe(false);
      expect(screen.getByTestId('preview').textContent).not.toMatch(MARKS_RE);
      await check(user);
      expect(counterText()).toBe(first1);
    });

    it('после первой ошибки переключение не сбрасывает попытку: вторая ошибка в новом режиме даёт revealed', async () => {
      const user = setup();
      mount();
      await click(user, 'letter-ن');
      await check(user);
      expect(screen.getByTestId('trainer').getAttribute('data-status')).toBe('wrong');
      await click(user, 'mode-plain');
      expect(screen.getByTestId('trainer').getAttribute('data-status')).toBe('wrong');
      expect(screen.getAllByTestId('tile')).toHaveLength(1);
      await check(user);
      expect(screen.getByTestId('trainer').getAttribute('data-status')).toBe('revealed');
      expect(counterText()).toBe('С 1-й попытки: 0 · Со 2-й: 0 · Не решено: 1');
      expect(screen.getByTestId('correct').textContent).toBe(stripMarks(slotsToString(conjugatePast(demoVerb, ORD[0]))));
    });

    it('после показа правильной формы переключение меняет вид correct, счётчик не меняется', async () => {
      const user = setup();
      mount();
      await failTwice(user);
      const full = slotsToString(conjugatePast(demoVerb, ORD[0]));
      const failed1 = 'С 1-й попытки: 0 · Со 2-й: 0 · Не решено: 1';
      expect(screen.getByTestId('correct').textContent).toBe(full);
      await click(user, 'mode-plain');
      expect(screen.getByTestId('correct').textContent).toBe(stripMarks(full));
      expect(counterText()).toBe(failed1);
      await click(user, 'mode-vowelled');
      expect(screen.getByTestId('correct').textContent).toBe(full);
      expect(counterText()).toBe(failed1);
    });

    it('возврат на «С огласовками» в том же задании: палитра есть, строгая проверка', async () => {
      const user = setup();
      mount();
      await click(user, 'mode-plain');
      expectMarksHidden();
      await click(user, 'mode-vowelled');
      expect(pressed('mode-vowelled')).toBe('true');
      expectMarksShown();
      expect(verbForm()).toMatch(MARKS_RE);
      await build(user, stripped(demoVerb, ORD[0]));
      await check(user);
      expect(screen.getByTestId('trainer').getAttribute('data-status')).toBe('wrong');
      expect(counterText()).toBe('С 1-й попытки: 0 · Со 2-й: 0 · Не решено: 0');
    });

    it('переключение между верным ответом и автопереходом: следующее задание в выбранном режиме', async () => {
      const user = setup();
      mount();
      await solve(user, demoVerb, ORD[0]);
      await advance(ADVANCE_DELAY_MS - 100);
      await click(user, 'mode-plain');
      await advance(100);
      expect(pronounText()).toBe(pronounView(ORD[1], true));
      expectMarksHidden();
      expect(verbForm()).not.toMatch(MARKS_RE);
      expect(counterText()).toBe(first1);
    });

    it('после «Дальше» следующее задание в текущем режиме', async () => {
      const user = setup();
      mount();
      await failTwice(user);
      await click(user, 'mode-plain');
      await next(user);
      expect(pronounText()).toBe(pronounView(ORD[1], true));
      expectMarksHidden();
      await click(user, 'mode-vowelled');
      expect(pronounText()).toBe(PRONOUNS[ORD[1]].arabic);
      expectMarksShown();
    });

    it('режим не утекает между приложениями с пустым store', async () => {
      const user = setup();
      const { unmount } = render(
        <App verbs={[demoVerb]} missingRuleSources={[]} ruleSourcesFor={rules} random={first} store={fakeStore().store} />,
      );
      await click(user, 'mode-plain');
      unmount();
      render(<App verbs={[demoVerb]} missingRuleSources={[]} ruleSourcesFor={rules} random={first} store={fakeStore().store} />);
      expect(pressed('mode-vowelled')).toBe('true');
      expectMarksShown();
    });

    it('в гейте переключателя нет', () => {
      render(<App verbs={[]} missingRuleSources={['huwa']} ruleSourcesFor={rules} />);
      expect(screen.queryByTestId('mode-toggle')).toBeNull();
    });
  });
});

describe('App: буквы вразнобой', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('jest', { advanceTimersByTime: vi.advanceTimersByTime.bind(vi) });
  });
  const setup = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  const letters = () => screen.getAllByTestId(/^letter-/).map((b) => b.textContent as string);

  it('App передаёт random в TrainerScreen; в следующем задании порядок букв новый', async () => {
    const user = setup();
    const ctl = { v: 0 };
    render(<App verbs={[demoVerb]} missingRuleSources={[]} ruleSourcesFor={rules} random={() => ctl.v} store={fakeStore().store} />);
    const base = [...new Set([...demoVerb.root, 'ت', 'ن', 'و', 'ا', 'م'])];
    const firstOrder = letters();
    expect(firstOrder).toEqual(shuffleLetters(base, () => 0));
    ctl.v = 0.99;
    await failTwice(user);
    await next(user);
    const secondOrder = letters();
    expect(secondOrder).toEqual(shuffleLetters(base, () => 0.99));
    expect(secondOrder).not.toEqual(firstOrder);
  });
});

describe('App: сохранение, тема, настройки', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('jest', { advanceTimersByTime: vi.advanceTimersByTime.bind(vi) });
  });
  const setup = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  const mount = (fs = fakeStore()) => {
    render(<App verbs={[demoVerb]} missingRuleSources={[]} ruleSourcesFor={rules} random={first} store={fs.store} />);
    return fs;
  };
  const pressed = (id: string) => screen.getByTestId(id).getAttribute('aria-pressed');
  const themeAttr = () => document.documentElement.getAttribute('data-theme');
  const open = (user: User) => click(user, 'settings-btn');
  const c = (f: number, s: number, x: number) => `С 1-й попытки: ${f} · Со 2-й: ${s} · Не решено: ${x}`;

  it('счётчик, режим и тема восстанавливаются из store', () => {
    mount(fakeStore({ counter: { first: 4, second: 5, failed: 6 }, mode: 'plain', theme: 'dark' }));
    expect(counterText()).toBe(c(4, 5, 6));
    expect(pressed('mode-plain')).toBe('true');
    expect(themeAttr()).toBe('dark');
  });

  it('счётчик и режим пишутся в store', async () => {
    const user = setup();
    const fs = mount();
    await solve(user, demoVerb, ORD[0]);
    expect(fs.data.counter).toEqual({ first: 1, second: 0, failed: 0 });
    await click(user, 'mode-plain');
    expect(fs.data.mode).toBe('plain');
    expect(fs.data.counter).toEqual({ first: 1, second: 0, failed: 0 });
  });

  it('тема пишется в store и применяется; «Авто» снимает атрибут', async () => {
    const user = setup();
    const fs = mount();
    await open(user);
    await click(user, 'theme-dark');
    expect(themeAttr()).toBe('dark');
    expect(fs.data.theme).toBe('dark');
    await click(user, 'theme-light');
    expect(themeAttr()).toBe('light');
    await click(user, 'theme-auto');
    expect(themeAttr()).toBeNull();
    expect(fs.data.theme).toBe('auto');
  });

  it('панель: открывается и закрывается (⚙, Escape, Закрыть)', async () => {
    const user = setup();
    mount();
    const btn = screen.getByTestId('settings-btn');
    expect(btn.getAttribute('aria-label')).toBe('Настройки');
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByTestId('settings')).toBeNull();
    expect(screen.getByTestId('mode-toggle').contains(btn)).toBe(true);
    await user.click(btn);
    expect(screen.getByTestId('settings')).toBeTruthy();
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    await user.click(btn);
    expect(screen.queryByTestId('settings')).toBeNull();
    await user.click(btn);
    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('settings')).toBeNull();
    await user.click(btn);
    await click(user, 'settings-close');
    expect(screen.queryByTestId('settings')).toBeNull();
    expect(btn.getAttribute('aria-expanded')).toBe('false');
  });

  it('кнопки темы меняют aria-pressed, подписи', async () => {
    const user = setup();
    mount(fakeStore({ theme: 'light' }));
    await open(user);
    expect(screen.getByTestId('theme-auto').textContent).toBe('Авто');
    expect(screen.getByTestId('theme-light').textContent).toBe('Светлая');
    expect(screen.getByTestId('theme-dark').textContent).toBe('Тёмная');
    expect(pressed('theme-light')).toBe('true');
    await click(user, 'theme-dark');
    expect(pressed('theme-dark')).toBe('true');
    expect(pressed('theme-light')).toBe('false');
    expect(pressed('theme-auto')).toBe('false');
  });

  it('сброс: «Нет» ничего не меняет', async () => {
    const user = setup();
    const fs = mount(fakeStore({ counter: { first: 2, second: 1, failed: 1 }, theme: 'dark' }));
    await open(user);
    expect(screen.getByTestId('reset-btn').textContent).toBe('Сбросить прогресс');
    await click(user, 'reset-btn');
    expect(screen.queryByTestId('reset-btn')).toBeNull();
    expect(screen.getByTestId('reset-confirm').textContent).toContain('Точно сбросить?');
    await click(user, 'reset-no');
    expect(screen.queryByTestId('reset-confirm')).toBeNull();
    expect(screen.getByTestId('reset-btn')).toBeTruthy();
    expect(counterText()).toBe(c(2, 1, 1));
    expect(fs.data.counter).toEqual({ first: 2, second: 1, failed: 1 });
  });

  it('сброс: «Да» обнуляет счётчик в UI и store, mode и theme остаются, панель закрыта, новое задание', async () => {
    const user = setup();
    const fs = mount(fakeStore({ counter: { first: 2, second: 1, failed: 1 }, mode: 'plain', theme: 'dark' }));
    await click(user, 'letter-ن');
    expect(screen.queryAllByTestId('tile')).toHaveLength(1);
    await open(user);
    await click(user, 'reset-btn');
    await click(user, 'reset-yes');
    expect(screen.queryByTestId('settings')).toBeNull();
    expect(counterText()).toBe(c(0, 0, 0));
    expect(fs.data).toEqual({ counter: { first: 0, second: 0, failed: 0 }, mode: 'plain', theme: 'dark' });
    expect(pronounText()).toBe(pronounView(ORD2[0], true));
    expect(screen.queryAllByTestId('tile')).toHaveLength(0);
    expect(pressed('mode-plain')).toBe('true');
    expect(themeAttr()).toBe('dark');
  });

  it('сброс начинает новую перестановку (а не прежний порядок)', async () => {
    const user = setup();
    const ctl = { v: 0 };
    render(<App verbs={[demoVerb]} missingRuleSources={[]} ruleSourcesFor={rules} random={() => ctl.v} store={fakeStore().store} />);
    await failTwice(user);
    await next(user);
    expect(pronounText()).toBe(PRONOUNS[ORD[1]].arabic);
    ctl.v = 0.5;
    const alt = shufflePronouns(() => 0.5);
    expect(alt[0]).not.toBe(ORD[0]);
    await open(user);
    await click(user, 'reset-btn');
    await click(user, 'reset-yes');
    expect(pronounText()).toBe(PRONOUNS[alt[0]].arabic);
    await failTwice(user);
    await next(user);
    expect(pronounText()).toBe(PRONOUNS[alt[1]].arabic);
  });

  it('после сброса первое местоимение не равно прежнему (даже если random дал бы то же)', async () => {
    const user = setup();
    mount();
    const before = currentId();
    expect(shufflePronouns(first)[0]).toBe(before);
    await open(user);
    await click(user, 'reset-btn');
    await click(user, 'reset-yes');
    expect(currentId()).not.toBe(before);
  });

  it('сброс снимает таймер автоперехода', async () => {
    const user = setup();
    mount();
    await solve(user, demoVerb, ORD[0]);
    await advance(300);
    await open(user);
    await click(user, 'reset-btn');
    await click(user, 'reset-yes');
    expect(counterText()).toBe(c(0, 0, 0));
    await advance(ADVANCE_DELAY_MS);
    expect(pronounText()).toBe(PRONOUNS[ORD2[0]].arabic);
    expect(counterText()).toBe(c(0, 0, 0));
  });

  it('в гейте настроек нет', () => {
    render(<App verbs={[]} missingRuleSources={['huwa']} ruleSourcesFor={rules} store={fakeStore().store} />);
    expect(screen.queryByTestId('settings-btn')).toBeNull();
    expect(screen.queryByTestId('settings')).toBeNull();
  });

  it('недоступный store (бросает исключения) не ломает приложение', async () => {
    const user = setup();
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('no');
      },
      setItem: () => {
        throw new Error('no');
      },
    });
    render(<App verbs={[demoVerb]} missingRuleSources={[]} ruleSourcesFor={rules} random={first} />);
    await solve(user, demoVerb, ORD[0]);
    expect(counterText()).toBe(c(1, 0, 0));
    await open(user);
    await click(user, 'theme-dark');
    await click(user, 'reset-btn');
    await click(user, 'reset-yes');
    expect(counterText()).toBe(c(0, 0, 0));
  });
});

describe('App: ручной выбор глагола', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('jest', { advanceTimersByTime: vi.advanceTimersByTime.bind(vi) });
  });
  const setup = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  const mount = (fs = fakeStore(), verbs: Verb[] = demoVerbs) => {
    render(<App verbs={verbs} missingRuleSources={[]} ruleSourcesFor={rules} random={first} store={fs.store} />);
    return fs;
  };
  const open = (user: User) => click(user, 'settings-btn');
  const options = () => screen.queryAllByTestId('verb-option');
  const ids = () => options().map((o) => o.getAttribute('data-verb-id'));
  const search = (user: User, text: string) => user.type(screen.getByTestId('verb-search'), text);
  const pick = (user: User, id: string) =>
    user.click(options().find((o) => o.getAttribute('data-verb-id') === id) as HTMLElement);
  const MARKS_RE = /[\u064b-\u0652]/;
  const c = (f: number, s: number, x: number) => `С 1-й попытки: ${f} · Со 2-й: ${s} · Не решено: ${x}`;

  it('панель: блок «Глагол» со всеми глаголами и полем поиска', async () => {
    const user = setup();
    mount();
    await open(user);
    const picker = screen.getByTestId('verb-picker');
    expect(screen.getByTestId('settings').contains(picker)).toBe(true);
    const input = screen.getByTestId('verb-search') as HTMLInputElement;
    expect(input.type).toBe('search');
    expect(input.getAttribute('aria-label')).toBe('Поиск глагола');
    expect(input.getAttribute('dir')).toBe('auto');
    expect(input.getAttribute('placeholder')).toBe('Поиск по корню');
    expect(screen.getByTestId('verb-list').contains(options()[0])).toBe(true);
    expect(ids()).toEqual(demoVerbs.map((v) => v.id));
    expect(screen.queryByTestId('verb-empty')).toBeNull();
  });

  it('элемент: форма هو (lang ar, rtl) и ссылка на словарь', async () => {
    const user = setup();
    mount();
    await open(user);
    const form = options()[0].querySelector('[lang="ar"]') as HTMLElement;
    expect(form.getAttribute('dir')).toBe('rtl');
    expect(form.textContent).toBe(huwa(demoVerbs[0]));
    expect(options()[0].textContent).toContain('TEST-DICT');
    expect(options()[0].hasAttribute('data-verb-id')).toBe(true);
  });

  it('поиск фильтрует по корню, по части корня, без огласовок и с ними', async () => {
    const user = setup();
    mount();
    await open(user);
    await search(user, '\u0633\u0645\u0639');
    expect(ids()).toEqual(['demo-sami3a']);
    await user.clear(screen.getByTestId('verb-search'));
    expect(ids()).toHaveLength(3);
    await search(user, '\u0635\u0631');
    expect(ids()).toEqual(['demo-nasara']);
    await user.clear(screen.getByTestId('verb-search'));
    await search(user, huwa(demoVerbs[2]));
    expect(ids()).toEqual(['demo-karuma']);
  });

  it('нет результатов: «Ничего не найдено»', async () => {
    const user = setup();
    mount();
    await open(user);
    await search(user, '\u0628\u0628\u0628');
    expect(options()).toHaveLength(0);
    expect(screen.getByTestId('verb-empty').textContent).toBe('Ничего не найдено');
    await user.clear(screen.getByTestId('verb-search'));
    expect(screen.queryByTestId('verb-empty')).toBeNull();
    expect(options()).toHaveLength(3);
  });

  it('выбор: форма, первое местоимение новой перестановки, ответ пуст, счётчик цел, панель закрыта, поиск очищен', async () => {
    const user = setup();
    mount(fakeStore({ counter: { first: 3, second: 2, failed: 1 } }));
    expect(verbForm()).toBe(huwa(demoVerbs[0]));
    await click(user, 'letter-ن');
    await open(user);
    await search(user, '\u0643');
    await pick(user, 'demo-karuma');
    expect(verbForm()).toBe(huwa(demoVerbs[2]));
    expect(pronounText()).toBe(PRONOUNS[ORD2[0]].arabic);
    expect(screen.queryAllByTestId('tile')).toHaveLength(0);
    expect(counterText()).toBe(c(3, 2, 1));
    expect(screen.queryByTestId('settings')).toBeNull();
    await open(user);
    expect((screen.getByTestId('verb-search') as HTMLInputElement).value).toBe('');
    expect(options()).toHaveLength(3);
  });

  it('поле поиска очищается и при закрытии панели без выбора', async () => {
    const user = setup();
    mount();
    await open(user);
    await search(user, '\u0643');
    await click(user, 'settings-close');
    await open(user);
    expect((screen.getByTestId('verb-search') as HTMLInputElement).value).toBe('');
  });

  it('выбор посреди задания: ответ сброшен без подсчёта', async () => {
    const user = setup();
    mount();
    await click(user, 'letter-ن');
    await check(user);
    await click(user, 'letter-ص');
    await open(user);
    await pick(user, 'demo-sami3a');
    expect(screen.queryAllByTestId('tile')).toHaveLength(0);
    expect(screen.getByTestId('trainer').getAttribute('data-status')).toBe('idle');
    expect(counterText()).toBe(c(0, 0, 0));
  });

  it('выбор после верного ответа до автоперехода снимает таймер', async () => {
    const user = setup();
    mount();
    await solve(user, demoVerb, ORD[0]);
    await advance(300);
    await open(user);
    await pick(user, 'demo-karuma');
    expect(counterText()).toBe(c(1, 0, 0));
    await advance(ADVANCE_DELAY_MS * 2);
    expect(pronounText()).toBe(PRONOUNS[ORD2[0]].arabic);
    expect(verbForm()).toBe(huwa(demoVerbs[2]));
    expect(counterText()).toBe(c(1, 0, 0));
  });

  it('выбор текущего глагола посреди ряда начинает новую перестановку, первое не равно прежнему', async () => {
    const user = setup();
    const ctl = { v: 0 };
    render(<App verbs={demoVerbs} missingRuleSources={[]} ruleSourcesFor={rules} random={() => ctl.v} store={fakeStore().store} />);
    await failTwice(user);
    await next(user);
    await failTwice(user);
    await next(user);
    expect(pronounText()).toBe(PRONOUNS[ORD[2]].arabic);
    ctl.v = 0.5;
    const alt = shufflePronouns(() => 0.5);
    expect(alt).not.toEqual(ORD);
    expect(alt[0]).not.toBe(ORD[2]);
    await open(user);
    expect(options()[0].getAttribute('aria-current')).toBe('true');
    await pick(user, 'demo-nasara');
    expect(pronounText()).toBe(PRONOUNS[alt[0]].arabic);
    expect(verbForm()).toBe(huwa(demoVerbs[0]));
    expect(counterText()).toBe(c(0, 0, 2));
    await failTwice(user);
    await next(user);
    expect(pronounText()).toBe(PRONOUNS[alt[1]].arabic);
  });

  it('после выбора задания идут по новой перестановке (все 9 по разу), после девятого другой глагол', async () => {
    const user = setup();
    const ctl = { v: 0 };
    render(<App verbs={demoVerbs} missingRuleSources={[]} ruleSourcesFor={rules} random={() => ctl.v} store={fakeStore().store} />);
    ctl.v = 0.5;
    const alt = shufflePronouns(() => 0.5);
    await open(user);
    await pick(user, 'demo-sami3a');
    const seen: PronounId[] = [];
    for (const p of alt) {
      expect(currentId()).toBe(p);
      seen.push(currentId());
      expect(verbForm()).toBe(huwa(demoVerbs[1]));
      await failTwice(user);
      await next(user);
    }
    expect([...seen].sort()).toEqual([...PRONOUN_ORDER].sort());
    expect(verbForm()).not.toBe(huwa(demoVerbs[1]));
    expect(currentId()).not.toBe(alt[8]);
  });

  it('после ручного выбора первое местоимение не равно прежнему (даже если random дал бы то же)', async () => {
    const user = setup();
    const ctl = { v: 0 };
    render(<App verbs={demoVerbs} missingRuleSources={[]} ruleSourcesFor={rules} random={() => ctl.v} store={fakeStore().store} />);
    const before = currentId();
    expect(shufflePronouns(() => 0)[0]).toBe(before);
    await open(user);
    await pick(user, 'demo-karuma');
    expect(currentId()).not.toBe(before);
  });

  it('aria-current только у текущего глагола', async () => {
    const user = setup();
    mount();
    await open(user);
    expect(options().map((o) => o.getAttribute('aria-current'))).toEqual(['true', null, null]);
    await pick(user, 'demo-karuma');
    await open(user);
    expect(options().map((o) => o.getAttribute('aria-current'))).toEqual([null, null, 'true']);
  });

  it('в vowelled формы со знаками, в plain без знаков', async () => {
    const user = setup();
    mount();
    await open(user);
    const forms = () => options().map((o) => (o.querySelector('[lang="ar"]') as HTMLElement).textContent ?? '');
    expect(forms()).toEqual(demoVerbs.map(huwa));
    expect(forms().every((f) => MARKS_RE.test(f))).toBe(true);
    await click(user, 'mode-plain');
    expect(forms()).toEqual(demoVerbs.map((v) => stripMarks(huwa(v))));
    expect(forms().some((f) => MARKS_RE.test(f))).toBe(false);
  });

  it('в гейте блока «Глагол» нет', () => {
    render(<App verbs={[]} missingRuleSources={['huwa']} ruleSourcesFor={rules} store={fakeStore().store} />);
    expect(screen.queryByTestId('verb-picker')).toBeNull();
  });

  it('выбор не пишет verb/index в store: только counter, mode, theme', async () => {
    const user = setup();
    const fs = mount();
    await open(user);
    await pick(user, 'demo-karuma');
    expect(Object.keys(fs.data).sort()).toEqual(['counter', 'mode', 'theme']);
    for (const sv of fs.saves) expect(Object.keys(sv).sort()).toEqual(['counter', 'mode', 'theme']);
    expect(within(screen.getByTestId('trainer')).getByTestId('verb-form').textContent).toBe(huwa(demoVerbs[2]));
  });
});

describe('App: виртуальная арабская клавиатура', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('jest', { advanceTimersByTime: vi.advanceTimersByTime.bind(vi) });
  });
  const setup = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  const mount = () => {
    render(<App verbs={demoVerbs} missingRuleSources={[]} ruleSourcesFor={rules} random={first} store={fakeStore().store} />);
  };
  const open = (user: User) => click(user, 'settings-btn');
  const input = () => screen.getByTestId('verb-search') as HTMLInputElement;
  const ids = () => screen.queryAllByTestId('verb-option').map((o) => o.getAttribute('data-verb-id'));
  const key = (user: User, letter: string) =>
    user.click(screen.getAllByTestId('kbd-key').find((k) => k.getAttribute('data-letter') === letter) as HTMLElement);
  const ORDER = Array.from('بتثجحخدذرزسشصضطظعغفقكلمنه');
  const NSR = 'نصر';

  it('кнопка есть, клавиатуры нет, поле без inputMode', async () => {
    const user = setup();
    mount();
    await open(user);
    const t = screen.getByTestId('kbd-toggle');
    expect(t.textContent).toBe('⌨');
    expect(t.getAttribute('aria-label')).toBe('Виртуальная клавиатура');
    expect(t.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByTestId('kbd')).toBeNull();
    expect(input().hasAttribute('inputmode')).toBe(false);
  });

  it('показ и скрытие: 25 букв по порядку, ⌫, Очистить, inputMode', async () => {
    const user = setup();
    mount();
    await open(user);
    await click(user, 'kbd-toggle');
    const kbd = screen.getByTestId('kbd');
    expect(kbd.getAttribute('role')).toBe('group');
    expect(kbd.getAttribute('aria-label')).toBe('Арабская клавиатура');
    expect(kbd.getAttribute('dir')).toBe('rtl');
    expect(kbd.getAttribute('lang')).toBe('ar');
    expect(screen.getByTestId('kbd-toggle').getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByTestId('kbd-toggle').getAttribute('aria-controls')).toBe(kbd.id);
    expect(kbd.id).not.toBe('');
    const keys = screen.getAllByTestId('kbd-key');
    expect(keys.map((k) => k.getAttribute('data-letter'))).toEqual(ORDER);
    expect(keys.map((k) => k.getAttribute('aria-label'))).toEqual(ORDER);
    expect(keys.every((k) => k.getAttribute('type') === 'button')).toBe(true);
    expect(screen.getByTestId('kbd-backspace').textContent).toBe('⌫');
    expect(screen.getByTestId('kbd-backspace').getAttribute('aria-label')).toBe('Стереть последнюю букву');
    expect(screen.getByTestId('kbd-clear').textContent).toBe('Очистить');
    expect(screen.getByTestId('kbd-clear').getAttribute('aria-label')).toBe('Очистить поиск');
    expect(input().getAttribute('inputmode')).toBe('none');
    await click(user, 'kbd-toggle');
    expect(screen.queryByTestId('kbd')).toBeNull();
    expect(screen.getByTestId('kbd-toggle').getAttribute('aria-expanded')).toBe('false');
    expect(input().hasAttribute('inputmode')).toBe(false);
  });

  it('буквы собирают запрос и фильтруют список', async () => {
    const user = setup();
    mount();
    await open(user);
    await click(user, 'kbd-toggle');
    await key(user, 'ن');
    await key(user, 'ص');
    await key(user, 'ر');
    expect(input().value).toBe(NSR);
    expect(ids()).toEqual(['demo-nasara']);
  });

  it('⌫ удаляет последнюю букву, «Очистить» сбрасывает поле и список', async () => {
    const user = setup();
    mount();
    await open(user);
    await click(user, 'kbd-toggle');
    await key(user, 'ن');
    await key(user, 'ص');
    await key(user, 'ر');
    await click(user, 'kbd-backspace');
    expect(input().value).toBe('نص');
    await click(user, 'kbd-clear');
    expect(input().value).toBe('');
    expect(ids()).toEqual(demoVerbs.map((v) => v.id));
  });

  it('ввод обычным способом работает вместе с клавиатурой', async () => {
    const user = setup();
    mount();
    await open(user);
    await click(user, 'kbd-toggle');
    await key(user, 'ن');
    await user.type(input(), 'ص');
    await key(user, 'ر');
    expect(input().value).toBe(NSR);
    expect(ids()).toEqual(['demo-nasara']);
  });

  it('закрытие панели скрывает клавиатуру и очищает поле', async () => {
    const user = setup();
    mount();
    await open(user);
    await click(user, 'kbd-toggle');
    await key(user, 'ن');
    await click(user, 'settings-close');
    await open(user);
    expect(screen.queryByTestId('kbd')).toBeNull();
    expect(input().value).toBe('');
    expect(input().hasAttribute('inputmode')).toBe(false);
  });

  it('в гейте клавиатуры нет', () => {
    render(<App verbs={[]} missingRuleSources={['huwa']} ruleSourcesFor={rules} store={fakeStore().store} />);
    expect(screen.queryByTestId('kbd-toggle')).toBeNull();
    expect(screen.queryByTestId('kbd')).toBeNull();
  });

  it('выбор глагола после ввода с виртуальной клавиатуры: первое задание новой перестановки', async () => {
    const user = setup();
    mount();
    await open(user);
    await click(user, 'kbd-toggle');
    await key(user, 'ك');
    await key(user, 'ر');
    expect(ids()).toEqual(['demo-karuma']);
    await user.click(screen.getByTestId('verb-option'));
    expect(screen.queryByTestId('settings')).toBeNull();
    expect(within(screen.getByTestId('trainer')).getByTestId('verb-form').textContent).toBe(
      slotsToString(conjugatePast(demoVerbs[2], 'huwa')),
    );
    expect(screen.getByTestId('pronoun').textContent).toBe(PRONOUNS[ORD2[0]].arabic);
  });
});
