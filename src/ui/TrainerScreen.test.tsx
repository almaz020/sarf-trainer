// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { conjugatePast } from '../engine/conjugate';
import type { PronounId, Verb } from '../engine/paradigm';
import { slotsToString, type Haraka } from '../engine/slots';
import { demoRuleSources, demoVerb } from './demo';
import { stripMarks } from './plain';
import { BASE_EXTRA, buildPalette } from './palette';
import { PRONOUNS, pronounText } from './pronouns';
import { formatDictionaryRef, formatRuleRef } from './refs';
import { TrainerScreen } from './TrainerScreen';

afterEach(cleanup);

type Step = [letter: string, haraka?: Haraka, shadda?: boolean];
type User = ReturnType<typeof userEvent.setup>;

async function build(user: User, steps: Step[]) {
  for (const [letter, haraka, shadda] of steps) {
    await user.click(screen.getByTestId(`letter-${letter}`));
    if (haraka) await user.click(screen.getByTestId(`mark-${haraka}`));
    if (shadda) await user.click(screen.getByTestId('mark-shadda'));
  }
}

const check = (user: User) => user.click(screen.getByRole('button', { name: 'Проверить' }));
const status = () => screen.getByTestId('trainer').getAttribute('data-status');

// نَصَرْتُمْ
const antumSteps: Step[] = [['ن', 'fatha'], ['ص', 'fatha'], ['ر', 'sukun'], ['ت', 'damma'], ['م', 'sukun']];
// نَصَرْتُمْ без сукуна на конце
const antumNoSukun: Step[] = [['ن', 'fatha'], ['ص', 'fatha'], ['ر', 'sukun'], ['ت', 'damma'], ['م']];
// نَصَرْتُنَّ
const antunnaSteps: Step[] = [['ن', 'fatha'], ['ص', 'fatha'], ['ر', 'sukun'], ['ت', 'damma'], ['ن', 'fatha', true]];

const letterList = () => screen.getAllByTestId(/^letter-/).map((b) => b.textContent as string);

function setup(pronoun: PronounId = 'antum') {
  const onResult = vi.fn();
  const onNext = vi.fn();
  const user = userEvent.setup();
  render(<TrainerScreen verb={demoVerb} pronoun={pronoun} ruleSources={demoRuleSources} onResult={onResult} onNext={onNext} />);
  return { user, onResult, onNext };
}

describe('TrainerScreen: отображение', () => {
  it('исходная форма هو, ссылка на словарь, местоимение и описание', () => {
    setup('antum');
    expect(screen.getByTestId('verb-form').textContent).toBe(slotsToString(conjugatePast(demoVerb, 'huwa')));
    expect(screen.getByTestId('dictionary-ref').textContent).toBe(formatDictionaryRef(demoVerb.sources[0]));
    expect(screen.getByTestId('dictionary-ref').textContent).toContain('TEST-ENTRY');
    expect(screen.getByTestId('pronoun').textContent).toBe(PRONOUNS.antum.arabic);
    expect(screen.getByText('2 л., м. р., мн. ч.')).toBeTruthy();
  });

  it('палитра: все обязательные буквы, ровно 5 лишних, без дублей (корень نصر)', () => {
    setup();
    const letters = letterList();
    const req = [...new Set([...demoVerb.root, ...BASE_EXTRA])];
    expect(new Set(letters).size).toBe(letters.length);
    for (const l of req) expect(letters).toContain(l);
    expect(letters.filter((l) => !req.includes(l))).toHaveLength(5);
    expect(letters).toHaveLength(req.length + 5);
  });

  it('палитра: корни كرم и كتب не дают дубликатов и содержат обязательные', () => {
    const roots: Verb['root'][] = [['ك', 'ر', 'م'], ['ك', 'ت', 'ب']];
    for (const root of roots) {
      render(<TrainerScreen verb={{ ...demoVerb, root }} pronoun="hum" ruleSources={demoRuleSources} />);
      const letters = letterList();
      const req = [...new Set([...root, ...BASE_EXTRA])];
      expect(new Set(letters).size).toBe(letters.length);
      for (const l of req) expect(letters).toContain(l);
      expect(letters).toHaveLength(req.length + 5);
      cleanup();
    }
  });

  it('все знаки есть в палитре знаков', () => {
    setup();
    for (const m of ['fatha', 'damma', 'kasra', 'sukun', 'shadda', 'clear']) {
      expect(screen.getByTestId(`mark-${m}`)).toBeTruthy();
    }
    const sec = screen.getByTestId('mark-fatha').closest('.marks') as HTMLElement;
    expect(sec.classList.contains('is-hidden')).toBe(false);
    expect(sec.hasAttribute('aria-hidden')).toBe(false);
    for (const b of screen.getAllByTestId(/^mark-/)) expect((b as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('TrainerScreen: буквы вразнобой', () => {
  const mountWith = (random?: () => number, mode: 'vowelled' | 'plain' = 'vowelled') =>
    render(<TrainerScreen verb={demoVerb} pronoun="antum" ruleSources={demoRuleSources} mode={mode} random={random} />);
  const REQ = [...new Set([...demoVerb.root, ...BASE_EXTRA])];

  it('порядок и набор зависят от random', () => {
    mountWith(() => 0);
    const l0 = letterList();
    cleanup();
    mountWith(() => 0.99);
    const l1 = letterList();
    expect(l0).not.toEqual(l1);
    for (const l of [l0, l1]) {
      expect(new Set(l).size).toBe(l.length);
      expect(l).toHaveLength(REQ.length + 5);
      for (const r of REQ) expect(l).toContain(r);
    }
  });

  it('random=()=>0: набор и порядок равны buildPalette', () => {
    mountWith(() => 0);
    expect(letterList()).toEqual(buildPalette(demoVerb.root, () => 0));
  });

  it('без пропа random работает: обязательные буквы на месте', () => {
    mountWith(undefined);
    const l = letterList();
    for (const r of REQ) expect(l).toContain(r);
    expect(l).toHaveLength(REQ.length + 5);
  });

  it('порядок стабилен при вводе букв', async () => {
    mountWith(() => 0.37);
    const before = letterList();
    const user = userEvent.setup();
    await build(user, antumSteps);
    expect(letterList()).toEqual(before);
  });

  it('порядок стабилен при переключении режима и rerender того же задания', () => {
    let calls = 0;
    const random = () => {
      calls++;
      return (calls * 0.31) % 1;
    };
    const { rerender } = render(
      <TrainerScreen verb={demoVerb} pronoun="antum" ruleSources={demoRuleSources} mode="vowelled" random={random} />,
    );
    const before = letterList();
    const callsAfterMount = calls;
    rerender(<TrainerScreen verb={demoVerb} pronoun="antum" ruleSources={demoRuleSources} mode="plain" random={random} />);
    expect(letterList()).toEqual(before);
    rerender(<TrainerScreen verb={demoVerb} pronoun="antum" ruleSources={demoRuleSources} mode="vowelled" random={random} />);
    expect(letterList()).toEqual(before);
    expect(calls).toBe(callsAfterMount);
  });
});

describe('TrainerScreen: конструктор', () => {
  it('плитки и превью повторяют собранный ответ', async () => {
    const { user } = setup();
    await build(user, antumSteps);
    expect(screen.getAllByTestId('tile')).toHaveLength(5);
    expect(screen.getByTestId('preview').textContent).toBe(slotsToString(conjugatePast(demoVerb, 'antum')));
  });

  it('повторное нажатие той же огласовки снимает её', async () => {
    const { user } = setup();
    await build(user, [['ن', 'fatha']]);
    expect(screen.getByTestId('tile').textContent).toBe(slotsToString([{ letter: 'ن', shadda: false, haraka: 'fatha' }]));
    await user.click(screen.getByTestId('mark-fatha'));
    expect(screen.getByTestId('tile').textContent).toBe('ن');
  });

  it('«Стереть последнюю» и «Очистить»', async () => {
    const { user } = setup();
    await build(user, antumSteps);
    await user.click(screen.getByRole('button', { name: 'Стереть последнюю' }));
    expect(screen.getAllByTestId('tile')).toHaveLength(4);
    await user.click(screen.getByRole('button', { name: 'Очистить' }));
    expect(screen.queryAllByTestId('tile')).toHaveLength(0);
  });

  it('«Проверить» неактивна при пустом ответе', () => {
    setup();
    expect((screen.getByRole('button', { name: 'Проверить' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('TrainerScreen: проверка', () => {
  it('верно с 1-й попытки: зелёная индикация, ссылка на правило, нет «Дальше»', async () => {
    const { user, onResult } = setup();
    expect(screen.queryByTestId('rule-ref')).toBeNull();
    await build(user, antumSteps);
    await check(user);
    expect(status()).toBe('ok');
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledWith('first');
    expect(screen.getByTestId('rule-ref').textContent).toBe(formatRuleRef(demoRuleSources[0]));
    expect(screen.getByTestId('rule-ref').textContent).toContain('TEST-PAGE');
    expect(screen.queryByRole('button', { name: 'Дальше' })).toBeNull();
  });

  it('шадда в окончании antunna принимается', async () => {
    const { user, onResult } = setup('antunna');
    await build(user, antunnaSteps);
    await check(user);
    expect(onResult).toHaveBeenCalledWith('first');
  });

  it('неверно с 1-й попытки: красная индикация, ответ остаётся, правила и ответа ещё нет', async () => {
    const { user, onResult } = setup();
    await build(user, antumNoSukun);
    await check(user);
    expect(status()).toBe('wrong');
    expect(screen.getAllByTestId('tile')).toHaveLength(5);
    expect(screen.queryByTestId('rule-ref')).toBeNull();
    expect(screen.queryByTestId('correct')).toBeNull();
    expect(onResult).not.toHaveBeenCalled();
  });

  it('исправил и проверил: верно со 2-й попытки', async () => {
    const { user, onResult } = setup();
    await build(user, antumNoSukun);
    await check(user);
    await user.click(screen.getByTestId('mark-sukun'));
    await check(user);
    expect(status()).toBe('ok');
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledWith('second');
  });

  it('неверно во 2-й попытке: правильная форма, ссылка на правило, «Дальше»', async () => {
    const { user, onResult, onNext } = setup();
    await build(user, antumNoSukun);
    await check(user);
    await check(user);
    expect(status()).toBe('revealed');
    expect(screen.getByTestId('correct').textContent).toBe(slotsToString(conjugatePast(demoVerb, 'antum')));
    expect(screen.getByTestId('rule-ref').textContent).toBe(formatRuleRef(demoRuleSources[0]));
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledWith('failed');
    await user.click(screen.getByRole('button', { name: 'Дальше' }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('после верного ответа и после показа ответа повторная проверка и правка невозможны', async () => {
    const { user, onResult } = setup();
    await build(user, antumSteps);
    await check(user);
    const btn = screen.getByRole('button', { name: 'Проверить' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    await user.click(btn);
    expect(onResult).toHaveBeenCalledTimes(1);
    expect((screen.getByTestId('letter-ن') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('mark-fatha') as HTMLButtonElement).disabled).toBe(true);
    for (const name of ['Стереть последнюю', 'Очистить']) {
      expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true);
    }
    expect((screen.getByTestId('mark-clear') as HTMLButtonElement).disabled).toBe(true);
    for (const tile of screen.getAllByTestId('tile')) expect((tile as HTMLButtonElement).disabled).toBe(true);
  });

  it('после показа правильной формы (revealed) палитры, плитки и кнопки редактирования заблокированы', async () => {
    const { user } = setup();
    await build(user, antumNoSukun);
    await check(user);
    await check(user);
    expect(status()).toBe('revealed');
    const disabled = (el: HTMLElement) => (el as HTMLButtonElement).disabled;
    expect(disabled(screen.getByTestId('letter-ن'))).toBe(true);
    expect(disabled(screen.getByTestId('mark-fatha'))).toBe(true);
    expect(disabled(screen.getByTestId('mark-clear'))).toBe(true);
    expect(disabled(screen.getByRole('button', { name: 'Стереть последнюю' }))).toBe(true);
    expect(disabled(screen.getByRole('button', { name: 'Очистить' }))).toBe(true);
    const tiles = screen.getAllByTestId('tile');
    expect(tiles.length).toBeGreaterThan(0);
    for (const t of tiles) expect(disabled(t)).toBe(true);
  });

  it('отличие в один знак (нет сукуна на конце) не принимается как верное', async () => {
    const { user, onResult } = setup();
    await build(user, antumNoSukun);
    await check(user);
    expect(status()).not.toBe('ok');
    expect(onResult).not.toHaveBeenCalled();
  });
});

describe('TrainerScreen: направление, выбор плитки, знаки', () => {
  it('арабские блоки имеют dir="rtl" и lang="ar"', async () => {
    const { user } = setup();
    await build(user, antumNoSukun);
    await check(user);
    await check(user);
    const tiles = screen.getAllByTestId('tile')[0].parentElement as HTMLElement;
    const blocks = [tiles, ...['preview', 'verb-form', 'pronoun', 'correct'].map((id) => screen.getByTestId(id))];
    for (const el of blocks) {
      expect(el.getAttribute('dir')).toBe('rtl');
      expect(el.getAttribute('lang')).toBe('ar');
    }
  });

  it('клик по плитке выбирает её, следующий знак ставится на неё', async () => {
    const { user } = setup();
    await build(user, [['ن'], ['ص']]);
    await user.click(screen.getAllByTestId('tile')[0]);
    await user.click(screen.getByTestId('mark-kasra'));
    const tiles = screen.getAllByTestId('tile');
    expect(tiles[0].textContent).toBe(slotsToString([{ letter: 'ن', shadda: false, haraka: 'kasra' }]));
    expect(tiles[1].textContent).toBe('ص');
    expect(tiles[0].getAttribute('aria-pressed')).toBe('true');
  });

  it('mark-kasra, mark-shadda и mark-clear', async () => {
    const { user } = setup();
    await build(user, [['ن']]);
    await user.click(screen.getByTestId('mark-kasra'));
    expect(screen.getByTestId('tile').textContent).toBe(slotsToString([{ letter: 'ن', shadda: false, haraka: 'kasra' }]));
    await user.click(screen.getByTestId('mark-shadda'));
    expect(screen.getByTestId('tile').textContent).toBe(slotsToString([{ letter: 'ن', shadda: true, haraka: 'kasra' }]));
    await user.click(screen.getByTestId('mark-clear'));
    expect(screen.getByTestId('tile').textContent).toBe('ن');
  });
});

describe('TrainerScreen: режим plain', () => {
  const MARKS_RE = /[\u064b-\u0652]/;
  const antumLetters: Step[] = [['ن'], ['ص'], ['ر'], ['ت'], ['م']];
  const antunnaLetters: Step[] = [['ن'], ['ص'], ['ر'], ['ت'], ['ن']];

  function setupPlain(pronoun: PronounId = 'antum') {
    const onResult = vi.fn();
    const onNext = vi.fn();
    const user = userEvent.setup();
    render(
      <TrainerScreen
        verb={demoVerb}
        pronoun={pronoun}
        ruleSources={demoRuleSources}
        mode="plain"
        onResult={onResult}
        onNext={onNext}
      />,
    );
    return { user, onResult, onNext };
  }

  const markButtons = () => screen.getAllByTestId(/^mark-/) as HTMLButtonElement[];
  const expectMarksHidden = () => {
    expect(markButtons()).toHaveLength(6);
    const sec = screen.getByTestId('mark-fatha').closest('.marks') as HTMLElement;
    expect(sec.classList.contains('is-hidden')).toBe(true);
    expect(sec.getAttribute('aria-hidden')).toBe('true');
    expect(markButtons().every((b) => b.disabled && b.tabIndex === -1)).toBe(true);
  };

  it('палитра знаков и «Убрать знак» скрыты и недоступны, но остаются в DOM', () => {
    setupPlain();
    expectMarksHidden();
    expect(screen.getAllByTestId(/^letter-/).length).toBeGreaterThan(0);
  });

  it('клик по скрытой mark-кнопке ничего не меняет в ответе', async () => {
    const { user } = setupPlain();
    await user.click(screen.getAllByTestId(/^letter-/)[0]);
    const before = screen.getByTestId('preview').textContent;
    for (const b of markButtons()) await user.click(b);
    expect(screen.getByTestId('preview').textContent).toBe(before);
    expect(screen.getAllByTestId('tile')).toHaveLength(1);
  });

  it('pronoun: anti с одной кясрой (U+0650), остальные без знаков', () => {
    const marksOf = (t: string) => Array.from(t).filter((ch) => MARKS_RE.test(ch));
    setupPlain('anti');
    expect(screen.getByTestId('pronoun').textContent).toBe(pronounText('anti', true));
    expect(marksOf(screen.getByTestId('pronoun').textContent as string)).toEqual(['\u0650']);
    cleanup();
    for (const id of Object.keys(PRONOUNS).filter((i) => i !== 'anti') as PronounId[]) {
      setupPlain(id);
      expect(screen.getByTestId('pronoun').textContent).toBe(stripMarks(PRONOUNS[id].arabic));
      expect(screen.getByTestId('pronoun').textContent).not.toMatch(MARKS_RE);
      cleanup();
    }
  });

  it('pronoun в vowelled как раньше (anti с полной огласовкой)', () => {
    setup('anti');
    expect(screen.getByTestId('pronoun').textContent).toBe(PRONOUNS.anti.arabic);
  });

  it('verb-form и pronoun без знаков', () => {
    setupPlain('antum');
    expect(screen.getByTestId('verb-form').textContent).not.toMatch(MARKS_RE);
    expect(screen.getByTestId('pronoun').textContent).not.toMatch(MARKS_RE);
    expect(screen.getByTestId('pronoun').textContent).toBe(stripMarks(PRONOUNS.antum.arabic));
  });

  it('antum: ответ из одних букв верен с 1-й попытки', async () => {
    const { user, onResult } = setupPlain('antum');
    await build(user, antumLetters);
    await check(user);
    expect(status()).toBe('ok');
    expect(onResult).toHaveBeenCalledWith('first');
  });

  it('antunna: ответ из одних букв верен с 1-й попытки', async () => {
    const { user, onResult } = setupPlain('antunna');
    await build(user, antunnaLetters);
    await check(user);
    expect(onResult).toHaveBeenCalledWith('first');
  });

  it('неверная буква не засчитывается', async () => {
    const { user, onResult } = setupPlain('antum');
    await build(user, [['ن'], ['ص'], ['ر'], ['ت'], ['ن']]);
    await check(user);
    expect(status()).toBe('wrong');
    expect(onResult).not.toHaveBeenCalled();
  });

  it('после двух ошибок correct без знаков, ссылки как в обычном режиме', async () => {
    const { user, onResult } = setupPlain('antum');
    await build(user, [['ن']]);
    await check(user);
    await check(user);
    expect(status()).toBe('revealed');
    const correct = screen.getByTestId('correct').textContent ?? '';
    expect(correct).not.toMatch(MARKS_RE);
    expect(correct).toBe(stripMarks(slotsToString(conjugatePast(demoVerb, 'antum'))));
    expect(screen.getByTestId('rule-ref').textContent).toBe(formatRuleRef(demoRuleSources[0]));
    expect(screen.getByTestId('dictionary-ref').textContent).toBe(formatDictionaryRef(demoVerb.sources[0]));
    expect(onResult).toHaveBeenCalledWith('failed');
  });

  it('rerender с другим mode: ответ сохраняется, текст плиток меняется, проверка по текущему режиму', async () => {
    const user = userEvent.setup();
    const onResult = vi.fn();
    const ui = (mode: 'vowelled' | 'plain') => (
      <TrainerScreen verb={demoVerb} pronoun="antum" ruleSources={demoRuleSources} mode={mode} onResult={onResult} />
    );
    const { rerender } = render(ui('vowelled'));
    await build(user, antumSteps);
    const tileTexts = () => screen.getAllByTestId('tile').map((t) => t.textContent ?? '');
    const full = antumSteps.length;
    expect(tileTexts()).toHaveLength(full);
    expect(tileTexts().some((t) => MARKS_RE.test(t))).toBe(true);
    rerender(ui('plain'));
    expect(tileTexts()).toHaveLength(full);
    expect(tileTexts().some((t) => MARKS_RE.test(t))).toBe(false);
    expect(screen.getByTestId('preview').textContent).toBe(stripMarks(slotsToString(conjugatePast(demoVerb, 'antum'))));
    expectMarksHidden();
    rerender(ui('vowelled'));
    expect(tileTexts()).toHaveLength(full);
    expect(tileTexts().some((t) => MARKS_RE.test(t))).toBe(true);
    expect(screen.getByTestId('preview').textContent).toBe(slotsToString(conjugatePast(demoVerb, 'antum')));
    // проверка по текущему режиму: ответ без сукуна неверен в vowelled, но верен в plain
    await user.click(screen.getByRole('button', { name: 'Очистить' }));
    await build(user, antumNoSukun);
    rerender(ui('plain'));
    await check(user);
    expect(onResult).toHaveBeenCalledWith('first');
  });
});
