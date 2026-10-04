import { useReducer, useState } from 'react';
import { conjugatePast } from '../engine/conjugate';
import type { PronounId, SourceRef, Verb } from '../engine/paradigm';
import { slotsToString, type Haraka } from '../engine/slots';
import { check, initialAttempt, resultOf, type AttemptResult, type Mode } from './attempt';
import { builderReducer, emptyState } from './builder';
import { stripMarks } from './plain';
import { PRONOUNS, pronounText } from './pronouns';
import { formatDictionaryRef, formatRuleRef, primarySource } from './refs';
import { shuffleLetters } from './shuffle';

const EXTRA_LETTERS = ['ت', 'ن', 'و', 'ا', 'م'];

// Знаки показываются на пунктирном кружке; названия по-русски для доступности.
const DOTTED_CIRCLE = '\u25cc';
const MARKS: { haraka: Haraka; glyph: string; name: string }[] = [
  { haraka: 'fatha', glyph: '\u064e', name: 'Фатха' },
  { haraka: 'damma', glyph: '\u064f', name: 'Дамма' },
  { haraka: 'kasra', glyph: '\u0650', name: 'Касра' },
  { haraka: 'sukun', glyph: '\u0652', name: 'Сукун' },
];
const SHADDA_GLYPH = '\u0651';

export interface TrainerScreenProps {
  verb: Verb;
  pronoun: PronounId;
  ruleSources: SourceRef[];
  mode?: Mode;
  random?: () => number;
  onResult?: (result: AttemptResult) => void;
  onNext?: () => void;
}

export function TrainerScreen({ verb, pronoun, ruleSources, mode = 'vowelled', random = Math.random, onResult, onNext }: TrainerScreenProps) {
  const [builder, dispatch] = useReducer(builderReducer, emptyState);
  const [attempt, setAttempt] = useState(initialAttempt);

  const expected = conjugatePast(verb, pronoun);
  const answering = attempt.phase === 'answering';
  // Порядок букв случайный один раз на задание (экран перемонтируется на каждое задание).
  const [letters] = useState(() => shuffleLetters([...new Set([...verb.root, ...EXTRA_LETTERS])], random));
  const status =
    attempt.phase === 'solved' ? 'ok' : attempt.phase === 'revealed' ? 'revealed' : attempt.wrong ? 'wrong' : 'idle';
  const plain = mode === 'plain';
  const show = (text: string) => (plain ? stripMarks(text) : text);
  const dictSource = primarySource(verb.sources);
  const ruleSource = primarySource(ruleSources);

  function onCheck() {
    const next = check(attempt, builder.slots, expected, mode);
    setAttempt(next);
    const result = resultOf(next);
    if (result) onResult?.(result);
  }

  return (
    <main className="trainer" data-testid="trainer" data-status={status}>
      <section className="verb">
        <div className="arabic big" lang="ar" dir="rtl" data-testid="verb-form">
          {show(slotsToString(conjugatePast(verb, 'huwa')))}
        </div>
        {dictSource && (
          <p className="ref" dir="auto" data-testid="dictionary-ref">
            {formatDictionaryRef(dictSource)}
          </p>
        )}
      </section>

      <section className="task">
        <div className="arabic pronoun" lang="ar" dir="rtl" data-testid="pronoun">
          {pronounText(pronoun, plain)}
        </div>
        <div className="pronoun-desc">{PRONOUNS[pronoun].description}</div>
      </section>

      <section className="answer" aria-label="Ответ">
        <div className="tiles arabic" lang="ar" dir="rtl">
          {builder.slots.map((slot, i) => (
            <button
              key={i}
              type="button"
              className="tile"
              data-testid="tile"
              aria-pressed={builder.selected === i}
              disabled={!answering}
              onClick={() => dispatch({ type: 'select', index: i })}
            >
              {show(slotsToString([slot]))}
            </button>
          ))}
        </div>
        <div className="preview arabic" lang="ar" dir="rtl" data-testid="preview">
          {show(slotsToString(builder.slots))}
        </div>
        <p role="status" className="sr-only">
          {status === 'ok' ? 'Верно' : status === 'wrong' || status === 'revealed' ? 'Неверно' : ''}
        </p>
      </section>

      <section className="palette letters arabic" lang="ar" dir="rtl" aria-label="Буквы">
        {letters.map((letter) => (
          <button
            key={letter}
            type="button"
            className="key"
            data-testid={`letter-${letter}`}
            disabled={!answering}
            onClick={() => dispatch({ type: 'addLetter', letter })}
          >
            {letter}
          </button>
        ))}
      </section>

      <section
        className={plain ? 'palette marks is-hidden' : 'palette marks'}
        aria-label="Знаки"
        aria-hidden={plain ? 'true' : undefined}
      >
        {MARKS.map((m) => (
          <button
            key={m.haraka}
            type="button"
            className="key arabic"
            aria-label={m.name}
            data-testid={`mark-${m.haraka}`}
            disabled={plain || !answering}
            tabIndex={plain ? -1 : undefined}
            onClick={() => dispatch({ type: 'setHaraka', haraka: m.haraka })}
          >
            {DOTTED_CIRCLE + m.glyph}
          </button>
        ))}
        <button
          type="button"
          className="key arabic"
          aria-label="Шадда"
          data-testid="mark-shadda"
          disabled={plain || !answering}
            tabIndex={plain ? -1 : undefined}
          onClick={() => dispatch({ type: 'toggleShadda' })}
        >
          {DOTTED_CIRCLE + SHADDA_GLYPH}
        </button>
        <button
          type="button"
          className="key clear"
          data-testid="mark-clear"
          disabled={plain || !answering}
            tabIndex={plain ? -1 : undefined}
          onClick={() => dispatch({ type: 'clearMarks' })}
        >
          Убрать знак
        </button>
      </section>

      <div className="ref-slot">
        {!answering && ruleSource && (
          <p className="ref" dir="auto" data-testid="rule-ref">
            {formatRuleRef(ruleSource)}
          </p>
        )}
      </div>

      <footer className="footer">
        <section className="actions">
          <button type="button" disabled={!answering} onClick={() => dispatch({ type: 'eraseLast' })}>
            Стереть последнюю
          </button>
          <button type="button" disabled={!answering} onClick={() => dispatch({ type: 'clearAll' })}>
            Очистить
          </button>
          <button type="button" className="primary" disabled={!answering || builder.slots.length === 0} onClick={onCheck}>
            Проверить
          </button>
        </section>

        {attempt.phase === 'revealed' && (
          <section className="reveal">
            <div className="arabic correct" lang="ar" dir="rtl" data-testid="correct">
              {show(slotsToString(expected))}
            </div>
            <button type="button" className="primary" onClick={onNext}>
              Дальше
            </button>
          </section>
        )}
      </footer>
    </main>
  );
}
