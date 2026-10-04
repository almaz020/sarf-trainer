import { useEffect, useId, useRef, useState } from 'react';
import { conjugatePast } from '../engine/conjugate';
import { ruleFor, type PronounId, type SourceRef, type Verb } from '../engine/paradigm';
import { slotsToString } from '../engine/slots';
import type { AttemptResult, Mode } from './attempt';
import { stripMarks } from './plain';
import { formatDictionaryRef, primarySource } from './refs';
import { addResult, currentPronoun, nextTask, selectVerb, startSession, type SessionState } from './session';
import { createStore, type Store } from './storage';
import { THEMES, applyTheme, type Theme } from './theme';
import { TrainerScreen } from './TrainerScreen';
import { searchVerbs } from './verbSearch';
import { ARABIC_KEYS, applyKey } from './keyboard';

// Задержка перед автопереходом после верного ответа (ТЗ п. 8).
export const ADVANCE_DELAY_MS = 1000;

export interface AppProps {
  verbs: Verb[];
  missingRuleSources: string[];
  ruleSourcesFor?: (pronoun: PronounId) => SourceRef[];
  random?: () => number;
  store?: Store;
}

export function App({
  verbs,
  missingRuleSources,
  ruleSourcesFor = (p) => ruleFor(p).sources,
  random = Math.random,
  store,
}: AppProps) {
  const [ownStore] = useState(() => store ?? createStore());
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
  return <Session verbs={verbs} ruleSourcesFor={ruleSourcesFor} random={random} store={ownStore} />;
}

interface SessionProps {
  verbs: Verb[];
  ruleSourcesFor: (pronoun: PronounId) => SourceRef[];
  random: () => number;
  store: Store;
}

const THEME_LABELS: Record<Theme, string> = { auto: 'Авто', light: 'Светлая', dark: 'Тёмная' };

interface SettingsProps {
  verbs: Verb[];
  current: Verb;
  mode: Mode;
  onSelectVerb: (verb: Verb) => void;
  theme: Theme;
  onTheme: (t: Theme) => void;
  onReset: () => void;
  onClose: () => void;
}

function Settings({ verbs, current, mode, onSelectVerb, theme, onTheme, onReset, onClose }: SettingsProps) {
  const [confirming, setConfirming] = useState(false);
  const [query, setQuery] = useState('');
  const [kbdOpen, setKbdOpen] = useState(false);
  const kbdId = useId();
  const found = searchVerbs(verbs, query);
  return (
    <div className="settings" data-testid="settings" role="dialog" aria-label="Настройки">
      <div className="settings-row">
        <span className="settings-label">Тема</span>
        {THEMES.map((t) => (
          <button
            key={t}
            type="button"
            className="mode-btn"
            data-testid={`theme-${t}`}
            aria-pressed={theme === t}
            onClick={() => onTheme(t)}
          >
            {THEME_LABELS[t]}
          </button>
        ))}
      </div>
      <div className="verb-picker" data-testid="verb-picker">
        <span className="settings-label">Глагол</span>
        <div className="verb-search-row">
          <input
            type="search"
            className="verb-search"
            data-testid="verb-search"
            aria-label="Поиск глагола"
            dir="auto"
            placeholder="Поиск по корню"
            inputMode={kbdOpen ? 'none' : undefined}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            type="button"
            className="mode-btn kbd-toggle"
            data-testid="kbd-toggle"
            aria-label="Виртуальная клавиатура"
            aria-expanded={kbdOpen}
            aria-controls={kbdId}
            onClick={() => setKbdOpen((o) => !o)}
          >
            ⌨
          </button>
        </div>
        {kbdOpen && (
          <div id={kbdId} className="kbd" data-testid="kbd" role="group" aria-label="Арабская клавиатура" dir="rtl" lang="ar">
            {ARABIC_KEYS.map((letter) => (
              <button
                key={letter}
                type="button"
                className="kbd-key arabic"
                data-testid="kbd-key"
                data-letter={letter}
                aria-label={letter}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setQuery((q) => applyKey(q, { type: 'letter', letter }))}
              >
                {letter}
              </button>
            ))}
            <button
              type="button"
              className="kbd-key"
              data-testid="kbd-backspace"
              aria-label="Стереть последнюю букву"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setQuery((q) => applyKey(q, { type: 'backspace' }))}
            >
              ⌫
            </button>
            <button
              type="button"
              className="kbd-key kbd-clear"
              data-testid="kbd-clear"
              aria-label="Очистить поиск"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setQuery((q) => applyKey(q, { type: 'clear' }))}
            >
              Очистить
            </button>
          </div>
        )}
        {found.length === 0 ? (
          <p className="verb-empty" data-testid="verb-empty">
            Ничего не найдено
          </p>
        ) : (
          <ul className="verb-list" data-testid="verb-list">
            {found.map((v) => {
              const form = slotsToString(conjugatePast(v, 'huwa'));
              const src = primarySource(v.sources);
              return (
                <li key={v.id}>
                  <button
                    type="button"
                    className="verb-option"
                    data-testid="verb-option"
                    data-verb-id={v.id}
                    aria-current={v === current ? 'true' : undefined}
                    onClick={() => onSelectVerb(v)}
                  >
                    <span className="arabic" lang="ar" dir="rtl">
                      {mode === 'plain' ? stripMarks(form) : form}
                    </span>
                    {src && <small className="verb-ref">{formatDictionaryRef(src)}</small>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="settings-row">
        {confirming ? (
          <div className="reset-confirm" data-testid="reset-confirm">
            <span>Точно сбросить?</span>
            <button type="button" className="mode-btn" data-testid="reset-yes" onClick={onReset}>
              Да
            </button>
            <button type="button" className="mode-btn" data-testid="reset-no" onClick={() => setConfirming(false)}>
              Нет
            </button>
          </div>
        ) : (
          <button type="button" className="mode-btn" data-testid="reset-btn" onClick={() => setConfirming(true)}>
            Сбросить прогресс
          </button>
        )}
      </div>
      <div className="settings-row">
        <button type="button" className="mode-btn" data-testid="settings-close" onClick={onClose}>
          Закрыть
        </button>
      </div>
    </div>
  );
}

function Session({ verbs, ruleSourcesFor, random, store }: SessionProps) {
  const [saved] = useState(() => store.load());
  const [session, setSession] = useState<SessionState>(() => ({
    ...startSession(verbs, random),
    counter: saved.counter,
  }));
  const [taskNo, setTaskNo] = useState(0);
  const [mode, setMode] = useState<Mode>(saved.mode);
  const [theme, setTheme] = useState<Theme>(saved.theme);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const latest = useRef(session);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const { counter } = session;
  useEffect(() => {
    store.save({ counter, mode, theme });
  }, [store, counter, mode, theme]);

  useEffect(() => {
    if (!settingsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSettingsOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [settingsOpen]);

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

  function onReset() {
    clearTimeout(timer.current);
    const cleared = store.clearProgress();
    commit({ ...startSession(verbs, random, currentPronoun(latest.current)), counter: cleared.counter });
    setTaskNo((n) => n + 1);
    setSettingsOpen(false);
  }

  function onSelectVerb(verb: Verb) {
    clearTimeout(timer.current);
    commit(selectVerb(latest.current, verb, random));
    setTaskNo((n) => n + 1);
    setSettingsOpen(false);
  }

  const pronoun = currentPronoun(session);

  return (
    <div className="session">
      <div className="topbar">
        <p className="counter" data-testid="counter">
          {`С 1-й попытки: ${counter.first} · Со 2-й: ${counter.second} · Не решено: ${counter.failed}`}
        </p>
        <div className="mode-toggle" data-testid="mode-toggle">
          <button
            type="button"
            className="mode-btn"
            data-testid="mode-vowelled"
            aria-pressed={mode === 'vowelled'}
            onClick={() => setMode('vowelled')}
          >
            С огласовками
          </button>
          <button
            type="button"
            className="mode-btn"
            data-testid="mode-plain"
            aria-pressed={mode === 'plain'}
            onClick={() => setMode('plain')}
          >
            Без огласовок
          </button>
          <button
            type="button"
            className="mode-btn settings-btn"
            data-testid="settings-btn"
            aria-label="Настройки"
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen((o) => !o)}
          >
            ⚙
          </button>
          {settingsOpen && (
            <Settings
              verbs={verbs}
              current={session.verb}
              mode={mode}
              onSelectVerb={onSelectVerb}
              theme={theme}
              onTheme={setTheme}
              onReset={onReset}
              onClose={() => setSettingsOpen(false)}
            />
          )}
        </div>
      </div>
      <TrainerScreen
        key={taskNo}
        verb={session.verb}
        pronoun={pronoun}
        ruleSources={ruleSourcesFor(pronoun)}
        mode={mode}
        random={random}
        onResult={onResult}
        onNext={advance}
      />
    </div>
  );
}
