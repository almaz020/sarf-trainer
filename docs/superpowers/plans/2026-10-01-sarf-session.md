# Ход тренировки и счётчик (этап 3): план реализации

> **Для исполнителя:** ОБЯЗАТЕЛЬНЫЙ SUB-SKILL: superpowers:subagent-driven-development (рекомендуется) или superpowers:executing-plans. Шаги отмечены чекбоксами (`- [ ]`).

**Цель:** сессия тренировки: случайный проверенный глагол, 9 заданий в порядке п. 4 ТЗ, автопереход через 1 с после верного ответа, «Дальше» после показа ответа, счётчик за сессию.

**Архитектура:** вся логика хода вынесена в чистый модуль `src/ui/session.ts` (порядок местоимений, счётчик, выбор глагола, состояние сессии). `App` после гейтов отдаёт управление внутреннему компоненту `Session`, который хранит состояние, считает результаты и ставит таймер. `TrainerScreen` и движок не меняются.

**Стек:** TypeScript, React, Vitest (fake timers), Testing Library.

**Спека:** `docs/superpowers/specs/2026-10-01-sarf-session-design.md`; требования: `TZ_sarf_trainer.md` (п. 8, «Ход тренировки» и «Проверка»).

## Глобальные ограничения

- Реализуется ровно то, что в ТЗ и спеке. Нет итогового экрана, кнопки «Завершить», «задание N из 9», хранения прогресса, перемешанного круга (CLAUDE.md: ничего сверх ТЗ).
- `src/engine`, `TrainerScreen.tsx`, `builder.ts`, `attempt.ts`, `refs.ts`, `pronouns.ts` не менять. Если для задачи нужно их менять, остановиться и спросить.
- Номера страниц, издания и ссылки не выдумывать. Тестовые фикстуры только в `src/ui/demo.ts` и тестах, значения `TEST-…`; в продакшен-сборку `demo.ts` не попадает.
- Знаки (U+064B–U+0652) в коде и тестах только через `\uXXXX`, сырые знаки не писать (допустимы только в комментариях).
- Порядок заданий: `hum, hiya, hunna, anta, antum, anti, antunna, ana, nahnu` (п. 4 ТЗ).
- `ADVANCE_DELAY_MS = 1000` (автопереход после верного ответа). Автоперехода после показа правильной формы нет.
- Счётчик за сессию: «С 1-й попытки: N · Со 2-й: N · Не решено: N», `data-testid="counter"`. Между сессиями ничего не сохраняется.
- Git нет, шагов commit нет.
- После изменений запускать `npm test`, `npx tsc --noEmit` и показывать результат. Красный тест 'paradigm.json: источники' (11 id) ожидаем, пока владелец не заполнит ссылки; остальные зелёные.

## Review Focus

1. Один результат задания даёт ровно одно приращение счётчика (никаких двойных подсчётов после автоперехода или «Дальше») (Задача 2).
2. Таймер автоперехода не остаётся после размонтирования `App` (Задача 2).
3. После 9-го задания при ≥2 глаголах выбирается другой глагол, при одном глаголе сессия продолжается с тем же без ошибки (Задачи 1 и 2).
4. `random()` возвращает значение, равное 1 (или близкое): выбор не выходит за границы массива (Задача 1).
5. `ruleSourcesFor` вызывается для текущего местоимения, после перехода ссылка на правило относится к новому (Задача 2).

## Структура файлов

| Файл | Ответственность |
|---|---|
| `src/ui/session.ts` | порядок заданий, счётчик, `pickVerb`, состояние сессии |
| `src/ui/App.tsx` | гейты, `Session`, таймер, счётчик на экране |
| `src/ui/demo.ts` | TEST-фикстуры (добавляются ещё два глагола) |
| `src/ui/index.css` | стиль строки счётчика |
| `src/main.tsx` | в `?demo` передаются все demo-глаголы |

---

### Задача 1: `session.ts`

**Files:**
- Create: `src/ui/session.ts`
- Test: `src/ui/session.test.ts`

**Interfaces:**
- Consumes: `PronounId`, `Verb` (engine/paradigm), `AttemptResult` (ui/attempt: `'first' | 'second' | 'failed'`).
- Produces: `PRONOUN_ORDER: PronounId[]`; `interface Counter { first: number; second: number; failed: number }`; `emptyCounter: Counter`; `addResult(counter: Counter, result: AttemptResult): Counter`; `pickVerb(verbs: Verb[], previous: Verb | null, random: () => number): Verb`; `interface SessionState { verb: Verb; index: number; counter: Counter }`; `startSession(verbs: Verb[], random: () => number): SessionState`; `nextTask(state: SessionState, verbs: Verb[], random: () => number): SessionState`; `currentPronoun(state: SessionState): PronounId`.

- [ ] **Шаг 1: Падающий тест** `src/ui/session.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import type { Verb } from '../engine/paradigm';
import {
  PRONOUN_ORDER,
  addResult,
  currentPronoun,
  emptyCounter,
  nextTask,
  pickVerb,
  startSession,
} from './session';

const mk = (id: string): Verb => ({
  id,
  root: ['ن', 'ص', 'ر'],
  midVowel: 'fatha',
  sources: [],
  verified: true,
});
const a = mk('a');
const b = mk('b');
const c = mk('c');

describe('PRONOUN_ORDER', () => {
  it('9 заданий в порядке п. 4 ТЗ', () => {
    expect(PRONOUN_ORDER).toEqual(['hum', 'hiya', 'hunna', 'anta', 'antum', 'anti', 'antunna', 'ana', 'nahnu']);
  });
});

describe('addResult', () => {
  it('каждый результат увеличивает своё поле на 1', () => {
    expect(addResult(emptyCounter, 'first')).toEqual({ first: 1, second: 0, failed: 0 });
    expect(addResult(emptyCounter, 'second')).toEqual({ first: 0, second: 1, failed: 0 });
    expect(addResult(emptyCounter, 'failed')).toEqual({ first: 0, second: 0, failed: 1 });
  });

  it('не мутирует исходный счётчик', () => {
    const before = { first: 1, second: 2, failed: 3 };
    addResult(before, 'first');
    expect(before).toEqual({ first: 1, second: 2, failed: 3 });
    expect(emptyCounter).toEqual({ first: 0, second: 0, failed: 0 });
  });
});

describe('pickVerb', () => {
  it('без предыдущего выбирает по random из всех', () => {
    expect(pickVerb([a, b, c], null, () => 0)).toBe(a);
    expect(pickVerb([a, b, c], null, () => 0.5)).toBe(b);
    expect(pickVerb([a, b, c], null, () => 0.99)).toBe(c);
  });

  it('никогда не возвращает предыдущий глагол при двух и более глаголах', () => {
    for (let i = 0; i < 100; i++) {
      expect(pickVerb([a, b, c], b, () => i / 100)).not.toBe(b);
      expect(pickVerb([a, b], a, () => i / 100)).toBe(b);
    }
  });

  it('из оставшихся выбирает по random', () => {
    expect(pickVerb([a, b, c], b, () => 0)).toBe(a);
    expect(pickVerb([a, b, c], b, () => 0.99)).toBe(c);
  });

  it('единственный глагол возвращается, даже если он предыдущий', () => {
    expect(pickVerb([a], a, () => 0.7)).toBe(a);
    expect(pickVerb([a], null, () => 0)).toBe(a);
  });

  it('random, равный 1, не выходит за границы', () => {
    expect(pickVerb([a, b, c], null, () => 1)).toBe(c);
    expect(pickVerb([a, b, c], c, () => 1)).toBe(b);
    expect(pickVerb([a], null, () => 1)).toBe(a);
  });
});

describe('сессия', () => {
  it('startSession: случайный глагол, первое задание hum, нулевой счётчик', () => {
    const s = startSession([a, b, c], () => 0.99);
    expect(s.verb).toBe(c);
    expect(s.index).toBe(0);
    expect(currentPronoun(s)).toBe('hum');
    expect(s.counter).toEqual(emptyCounter);
  });

  it('9 заданий одного глагола в порядке п. 4, счётчик сохраняется', () => {
    let s = startSession([a, b], () => 0);
    s = { ...s, counter: { first: 2, second: 1, failed: 4 } };
    const seen = [currentPronoun(s)];
    for (let i = 0; i < 8; i++) {
      s = nextTask(s, [a, b], () => 0);
      seen.push(currentPronoun(s));
      expect(s.verb).toBe(a);
    }
    expect(seen).toEqual(PRONOUN_ORDER);
    expect(s.counter).toEqual({ first: 2, second: 1, failed: 4 });
  });

  it('после 9-го задания новый глагол, не тот же, и снова hum', () => {
    let s = startSession([a, b], () => 0);
    for (let i = 0; i < 8; i++) s = nextTask(s, [a, b], () => 0);
    expect(currentPronoun(s)).toBe('nahnu');
    s = nextTask(s, [a, b], () => 0);
    expect(s.verb).toBe(b);
    expect(s.index).toBe(0);
    expect(currentPronoun(s)).toBe('hum');
  });

  it('с одним глаголом сессия продолжается тем же глаголом', () => {
    let s = startSession([a], () => 0);
    for (let i = 0; i < 9; i++) s = nextTask(s, [a], () => 0);
    expect(s.verb).toBe(a);
    expect(currentPronoun(s)).toBe('hum');
  });

  it('nextTask не мутирует предыдущее состояние', () => {
    const s = startSession([a, b], () => 0);
    const snapshot = JSON.stringify(s);
    nextTask(s, [a, b], () => 0);
    expect(JSON.stringify(s)).toBe(snapshot);
  });
});
```

- [ ] **Шаг 2: Запуск, ожидаем FAIL**

Run: `npx vitest run src/ui/session.test.ts`
Expected: FAIL (нет модуля `./session`).

- [ ] **Шаг 3: Реализация** `src/ui/session.ts`

```ts
import type { PronounId, Verb } from '../engine/paradigm';
import type { AttemptResult } from './attempt';

// Порядок заданий по глаголу: ТЗ п. 4 (hum → nahnu).
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

export interface SessionState {
  verb: Verb;
  index: number;
  counter: Counter;
}

export function startSession(verbs: Verb[], random: () => number): SessionState {
  return { verb: pickVerb(verbs, null, random), index: 0, counter: emptyCounter };
}

export function nextTask(state: SessionState, verbs: Verb[], random: () => number): SessionState {
  if (state.index + 1 < PRONOUN_ORDER.length) return { ...state, index: state.index + 1 };
  return { ...state, verb: pickVerb(verbs, state.verb, random), index: 0 };
}

export function currentPronoun(state: SessionState): PronounId {
  return PRONOUN_ORDER[state.index];
}
```

- [ ] **Шаг 4: Запуск, ожидаем PASS**

Run: `npm test` и `npx tsc --noEmit`
Expected: `session.test.ts` зелёный; один красный тест (источники), остальные зелёные; `tsc` без ошибок.

---

### Задача 2: `App`, счётчик, автопереход, demo-глаголы

**Files:**
- Modify: `src/ui/App.tsx` (заменить целиком), `src/ui/demo.ts` (заменить целиком), `src/ui/App.test.tsx` (заменить целиком), `src/ui/index.css` (дописать в конец), `src/main.tsx` (строки demo-ветки)

**Interfaces:**
- Consumes: `startSession`, `nextTask`, `currentPronoun`, `addResult`, `SessionState` (session); `AttemptResult` (attempt); `TrainerScreen` (props `verb`, `pronoun`, `ruleSources`, `onResult`, `onNext`); `ruleFor`.
- Produces: `ADVANCE_DELAY_MS = 1000`; `AppProps { verbs: Verb[]; missingRuleSources: string[]; ruleSourcesFor?: (p: PronounId) => SourceRef[]; random?: () => number }`; `App(props)`; `demoVerbs: Verb[]` (3 TEST-глагола, `demoVerbs[0] === demoVerb`).
- data-testid: `counter`, `gate`, `gate-sources`, `gate-verbs`, плюс все testid `TrainerScreen`.

- [ ] **Шаг 1: Падающий тест.** `src/ui/demo.ts` пока не трогать. Заменить `src/ui/App.test.tsx` целиком:

```tsx
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { conjugatePast } from '../engine/conjugate';
import type { PronounId, Verb } from '../engine/paradigm';
import { slotsToString, type Slot } from '../engine/slots';
import { ADVANCE_DELAY_MS, App } from './App';
import { demoRuleSources, demoVerb, demoVerbs } from './demo';
import { PRONOUNS } from './pronouns';
import { PRONOUN_ORDER } from './session';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const rules = () => demoRuleSources;
const first = () => 0;

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
const pronounText = () => screen.getByTestId('pronoun').textContent;
const verbForm = () => screen.getByTestId('verb-form').textContent;
const counterText = () => screen.getByTestId('counter').textContent;
const huwa = (v: Verb) => slotsToString(conjugatePast(v, 'huwa'));

describe('App: ход тренировки', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  const setup = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

  it('начало: случайный глагол, первое задание hum, счётчик нулевой', () => {
    render(<App verbs={demoVerbs} missingRuleSources={[]} ruleSourcesFor={rules} random={() => 0.99} />);
    expect(verbForm()).toBe(huwa(demoVerbs[2]));
    expect(pronounText()).toBe(PRONOUNS.hum.arabic);
    expect(counterText()).toBe('С 1-й попытки: 0 · Со 2-й: 0 · Не решено: 0');
  });

  it('верно с 1-й попытки: счётчик сразу, до 1000 мс то же задание со ссылкой на правило, затем следующее', async () => {
    const user = setup();
    const ruleSourcesFor = vi.fn((_p: PronounId) => demoRuleSources);
    render(<App verbs={[demoVerb]} missingRuleSources={[]} ruleSourcesFor={ruleSourcesFor} random={first} />);
    await solve(user, demoVerb, 'hum');
    expect(counterText()).toBe('С 1-й попытки: 1 · Со 2-й: 0 · Не решено: 0');
    expect(screen.getByTestId('rule-ref')).toBeTruthy();
    await advance(ADVANCE_DELAY_MS - 1);
    expect(pronounText()).toBe(PRONOUNS.hum.arabic);
    expect(screen.getByTestId('rule-ref')).toBeTruthy();
    await advance(1);
    expect(pronounText()).toBe(PRONOUNS.hiya.arabic);
    expect(screen.queryAllByTestId('tile')).toHaveLength(0);
    expect(screen.queryByTestId('rule-ref')).toBeNull();
    expect(counterText()).toBe('С 1-й попытки: 1 · Со 2-й: 0 · Не решено: 0');
    expect(ruleSourcesFor).toHaveBeenLastCalledWith('hiya');
  });

  it('верно со 2-й попытки: счётчик «Со 2-й»', async () => {
    const user = setup();
    render(<App verbs={[demoVerb]} missingRuleSources={[]} ruleSourcesFor={rules} random={first} />);
    await click(user, 'letter-ن');
    await check(user);
    await user.click(screen.getByRole('button', { name: 'Очистить' }));
    await solve(user, demoVerb, 'hum');
    expect(counterText()).toBe('С 1-й попытки: 0 · Со 2-й: 1 · Не решено: 0');
    await advance(ADVANCE_DELAY_MS);
    expect(pronounText()).toBe(PRONOUNS.hiya.arabic);
    expect(counterText()).toBe('С 1-й попытки: 0 · Со 2-й: 1 · Не решено: 0');
  });

  it('не решено: счётчик сразу, автоперехода нет даже через 5 с, переход только по «Дальше»', async () => {
    const user = setup();
    render(<App verbs={[demoVerb]} missingRuleSources={[]} ruleSourcesFor={rules} random={first} />);
    await failTwice(user);
    expect(counterText()).toBe('С 1-й попытки: 0 · Со 2-й: 0 · Не решено: 1');
    await advance(5000);
    expect(pronounText()).toBe(PRONOUNS.hum.arabic);
    expect(screen.getByTestId('correct').textContent).toBe(slotsToString(conjugatePast(demoVerb, 'hum')));
    await next(user);
    expect(pronounText()).toBe(PRONOUNS.hiya.arabic);
    expect(screen.queryAllByTestId('tile')).toHaveLength(0);
    expect(screen.getByTestId('trainer').getAttribute('data-status')).toBe('idle');
    expect(counterText()).toBe('С 1-й попытки: 0 · Со 2-й: 0 · Не решено: 1');
  });

  it('счётчик копится между заданиями, каждый результат считается один раз', async () => {
    const user = setup();
    render(<App verbs={[demoVerb]} missingRuleSources={[]} ruleSourcesFor={rules} random={first} />);
    await solve(user, demoVerb, 'hum');
    await advance(ADVANCE_DELAY_MS);
    await failTwice(user);
    await next(user);
    expect(counterText()).toBe('С 1-й попытки: 1 · Со 2-й: 0 · Не решено: 1');
    await advance(3000);
    expect(counterText()).toBe('С 1-й попытки: 1 · Со 2-й: 0 · Не решено: 1');
    expect(pronounText()).toBe(PRONOUNS.hunna.arabic);
  });

  it('9 заданий по глаголу в порядке п. 4, затем другой глагол и снова hum', async () => {
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
    expect(seen).toEqual(PRONOUN_ORDER.map((p) => PRONOUNS[p].arabic));
    expect(verbForm()).toBe(huwa(demoVerbs[1]));
    expect(pronounText()).toBe(PRONOUNS.hum.arabic);
    expect(counterText()).toBe('С 1-й попытки: 0 · Со 2-й: 0 · Не решено: 9');
  });

  it('с одним проверенным глаголом сессия продолжается тем же глаголом с hum', async () => {
    const user = setup();
    render(<App verbs={[demoVerb]} missingRuleSources={[]} ruleSourcesFor={rules} random={first} />);
    for (let i = 0; i < PRONOUN_ORDER.length; i++) {
      await failTwice(user);
      await next(user);
    }
    expect(verbForm()).toBe(huwa(demoVerb));
    expect(pronounText()).toBe(PRONOUNS.hum.arabic);
  });

  it('таймер автоперехода снимается при размонтировании', async () => {
    const user = setup();
    const { unmount } = render(<App verbs={[demoVerb]} missingRuleSources={[]} ruleSourcesFor={rules} random={first} />);
    await solve(user, demoVerb, 'hum');
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
```

- [ ] **Шаг 2: Запуск, ожидаем FAIL**

Run: `npx vitest run src/ui/App.test.tsx`
Expected: FAIL (нет `demoVerbs`, `ADVANCE_DELAY_MS`, счётчика).

- [ ] **Шаг 3: Фикстуры** `src/ui/demo.ts` заменить целиком:

```ts
import type { SourceRef, Verb } from '../engine/paradigm';

// Только для dev-режима ?demo и тестов. Значения TEST-… не являются реальными ссылками.
export const demoRuleSources: SourceRef[] = [
  { role: 'primary', book: 'TEST-GRAMMAR', edition: 'TEST-EDITION', section: 'TEST-SECTION', page: 'TEST-PAGE' },
];

const demoDictSource: SourceRef = {
  role: 'primary',
  book: 'TEST-DICT',
  entry: 'TEST-ENTRY',
  edition: 'TEST-EDITION',
  volume: 'TEST-VOL',
  page: 'TEST-PAGE',
};

export const demoVerb: Verb = {
  id: 'demo-nasara',
  root: ['ن', 'ص', 'ر'],
  midVowel: 'fatha',
  sources: [demoDictSource],
  verified: true,
};

export const demoVerbs: Verb[] = [
  demoVerb,
  { id: 'demo-sami3a', root: ['س', 'م', 'ع'], midVowel: 'kasra', sources: [demoDictSource], verified: true },
  { id: 'demo-karuma', root: ['ك', 'ر', 'م'], midVowel: 'damma', sources: [demoDictSource], verified: true },
];
```

- [ ] **Шаг 4: Реализация** `src/ui/App.tsx` заменить целиком:

```tsx
import { useEffect, useRef, useState } from 'react';
import { ruleFor, type PronounId, type SourceRef, type Verb } from '../engine/paradigm';
import type { AttemptResult } from './attempt';
import { addResult, currentPronoun, nextTask, startSession, type SessionState } from './session';
import { TrainerScreen } from './TrainerScreen';

// Задержка перед автопереходом после верного ответа (ТЗ п. 8).
export const ADVANCE_DELAY_MS = 1000;

export interface AppProps {
  verbs: Verb[];
  missingRuleSources: string[];
  ruleSourcesFor?: (pronoun: PronounId) => SourceRef[];
  random?: () => number;
}

export function App({
  verbs,
  missingRuleSources,
  ruleSourcesFor = (p) => ruleFor(p).sources,
  random = Math.random,
}: AppProps) {
  if (missingRuleSources.length > 0 || verbs.length === 0) {
    return (
      <main className="gate" data-testid="gate">
        {missingRuleSources.length > 0 && (
          <section data-testid="gate-sources">
            <p>Тренировка не запущена: у правил нет ссылки на источник.</p>
            <ul>
              {missingRuleSources.map((id) => (
                <li key={id}>
                  <code>{id}</code>
                </li>
              ))}
            </ul>
          </section>
        )}
        {verbs.length === 0 && <p data-testid="gate-verbs">Нет проверенных глаголов в verbs.json</p>}
      </main>
    );
  }
  return <Session verbs={verbs} ruleSourcesFor={ruleSourcesFor} random={random} />;
}

interface SessionProps {
  verbs: Verb[];
  ruleSourcesFor: (pronoun: PronounId) => SourceRef[];
  random: () => number;
}

function Session({ verbs, ruleSourcesFor, random }: SessionProps) {
  const [session, setSession] = useState<SessionState>(() => startSession(verbs, random));
  const [taskNo, setTaskNo] = useState(0);
  const latest = useRef(session);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  function commit(state: SessionState) {
    latest.current = state;
    setSession(state);
  }

  function advance() {
    commit(nextTask(latest.current, verbs, random));
    setTaskNo((n) => n + 1);
  }

  function onResult(result: AttemptResult) {
    commit({ ...latest.current, counter: addResult(latest.current.counter, result) });
    // Верно: следующее задание через 1 с. Показ правильной формы: только кнопка «Дальше».
    if (result !== 'failed') timer.current = setTimeout(advance, ADVANCE_DELAY_MS);
  }

  const { counter } = session;
  const pronoun = currentPronoun(session);

  return (
    <div className="session">
      <p className="counter" data-testid="counter">
        {`С 1-й попытки: ${counter.first} · Со 2-й: ${counter.second} · Не решено: ${counter.failed}`}
      </p>
      <TrainerScreen
        key={taskNo}
        verb={session.verb}
        pronoun={pronoun}
        ruleSources={ruleSourcesFor(pronoun)}
        onResult={onResult}
        onNext={advance}
      />
    </div>
  );
}
```

В конец `src/ui/index.css` дописать:

```css
.counter {
  max-width: 520px;
  margin: 0 auto;
  padding: 12px 16px 0;
  text-align: center;
  font-size: 0.85rem;
  color: var(--muted);
}
```

В `src/main.tsx` в demo-ветке заменить импорт и использование: `const { demoVerbs, demoRuleSources } = await import('./ui/demo');` и `<App verbs={demoVerbs} missingRuleSources={[]} ruleSourcesFor={() => demoRuleSources} />`. Остальное в файле не менять.

- [ ] **Шаг 5: Запуск, ожидаем PASS**

Run: `npm test`, `npx tsc --noEmit`, `npm run build`
Expected: все тесты `App.test.tsx` и `session.test.ts` зелёные; один красный (источники); `tsc` без ошибок; `vite build` успешен; `grep -r "TEST-" dist` ничего не находит (удалить `dist` после проверки). Проверить python-ом, что в изменённых .ts/.tsx нет сырых U+064B–U+0652 вне комментариев.

---

### Задача 3: визуальная проверка (выполняет контролёр)

- [ ] **Шаг 1:** Запустить dev-сервер (`.claude/launch.json`, конфигурация `vite`), открыть `http://localhost:5173/?demo`.
- [ ] **Шаг 2:** Решить первое задание верно (форма через JS-клики по testid) и проверить в реальном времени: счётчик «С 1-й попытки: 1», ссылка на правило видна, примерно через 1 с задание сменилось на `hiya`.
- [ ] **Шаг 3:** Дважды неверно: показан правильный ответ и «Дальше», автоперехода нет; счётчик «Не решено: 1». Пройти все 9 заданий, убедиться, что 10-е задание начинается с `hum` и с другим глаголом (в demo три глагола).
- [ ] **Шаг 4:** Снимки на ПК и на 360×800 (счётчик не ломает вёрстку, горизонтального скролла нет), затем вернуть `desktop`, остановить сервер.
- [ ] **Шаг 5:** `npm test`, `npx tsc --noEmit`, `npm run build`, показать результат (один красный тест источников, 11 id). Удалить `dist`. Остановиться: показать владельцу снимки и результат; это последний этап по п. 12 ТЗ.
