# Движок сарф-тренажёра (этап 1): план реализации

> **Для исполнителя:** ОБЯЗАТЕЛЬНЫЙ SUB-SKILL: superpowers:subagent-driven-development (рекомендуется) или superpowers:executing-plans. Шаги отмечены чекбоксами (`- [ ]`).

**Цель:** чистый движок спряжения الماضي (форма I, صحيح سالم) с данными, валидаторами и golden-тестами, без UI.

**Архитектура:** `slots.ts` (модель и сравнение), `paradigm.ts` + `paradigm.json` (окончания и источники как данные), `conjugate.ts` (основа + окончание из JSON), `validate.ts` (валидация глаголов и парадигмы). Движок без побочных эффектов, без консоли, без исключений на входных данных.

**Стек:** TypeScript, Vitest, npm. Без Vite и React.

**Спека:** `docs/superpowers/specs/2026-10-01-sarf-engine-design.md`; требования: `TZ_sarf_trainer.md` (п. 5–7, 9, 10, 12).

## Глобальные ограничения

- Реализуется ровно то, что в ТЗ и спеке. Правил, форм, местоимений и функций сверх них не добавлять (CLAUDE.md).
- Номера страниц, издания и ссылки не выдумывать: поля `edition`, `section`, `page` в `paradigm.json` и `verbs.json` остаются `""`. В тестовых фикстурах ссылки явно помечены `TEST-…`.
- Unicode: фатха U+064E, дамма U+064F, касра U+0650, сукун U+0652, шадда U+0651. Порядок в строке: буква → шадда → огласовка. Алиф только U+0627, татвиль запрещён.
- Ответ проверяется только `slotsEqual` на `Slot[]`, строки не сравниваются.
- Строки с огласовками в тестах собираются из констант `F, D, K, S, SH` (`\uXXXX`), литералы с огласовками не пишутся.
- `SourceRef.role: "primary" | "check"`: единственное добавление к ТЗ (спека, решение 2).
- Git-репозитория нет, шагов commit нет.
- После изменений в `src/engine`: `npm test` и показ результата. В конце этапа остановиться и показать результат владельцу. Ожидаемо один красный тест (источники).

## Review Focus

Входы, которые ТЗ подразумевает, но не называет. Каждый закреплён тестом в задаче-владельце.

1. Буква корня совпадает с буквой окончания (R1 или R2 = ت или ن, например كتب): никакого слияния и дедупликации (Задача 3).
2. Возвращаемые `Slot[]` не разделяют объекты с `paradigm.json`: мутация результата не портит следующий вызов (Задача 3).
3. Мусорный вход валидатора (`null`, строка, `root` не массив, элементы не строки) не бросает исключение (Задача 4).
4. Поля источника из одних пробелов считаются пустыми (Задача 4).
5. Нормализация NFC меняет порядок знаков и ломает порядок ТЗ п. 6: `slotsToString` не нормализует (Задача 1).

## Структура файлов

| Файл | Ответственность |
|---|---|
| `package.json`, `tsconfig.json` | каркас |
| `TZ_sarf_trainer.md` | копия ТЗ в корне |
| `src/engine/slots.ts` | `Haraka`, `Slot`, `slotsToString`, `slotsEqual` |
| `src/engine/paradigm.ts` | типы `PronounId`, `RuleId`, `SourceRef`, `Rule`, `Convention`, `Paradigm`, `Verb`; `paradigm`, `ruleFor` |
| `src/engine/conjugate.ts` | `conjugatePast` |
| `src/engine/validate.ts` | `validateVerb`, `filterVerbs`, `validateParadigm` |
| `src/data/paradigm.json` | 10 правил + 3 соглашения (`stem` и два орфографических) |
| `src/data/verbs.json` | один непроверенный пример |
| `src/engine/*.test.ts` | тесты |

---

### Задача 1: каркас и `slots.ts`

**Files:**
- Create: `package.json`, `tsconfig.json`, `TZ_sarf_trainer.md` (копия)
- Create: `src/engine/slots.ts`
- Test: `src/engine/slots.test.ts`

**Interfaces:**
- Produces: `type Haraka = 'fatha'|'damma'|'kasra'|'sukun'`; `interface Slot { letter: string; shadda: boolean; haraka: Haraka | null }`; `slotsToString(slots: Slot[]): string`; `slotsEqual(a: Slot[], b: Slot[]): boolean`.

- [ ] **Шаг 1: Каркас**

```bash
cp /Users/almaz/Downloads/TZ_sarf_trainer.md /Users/almaz/Claude/tasrif/TZ_sarf_trainer.md
cd /Users/almaz/Claude/tasrif
cat > package.json <<'EOF'
{
  "name": "sarf-trainer",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run"
  }
}
EOF
cat > tsconfig.json <<'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "resolveJsonModule": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
EOF
npm install -D vitest typescript
```

- [ ] **Шаг 2: Падающий тест** `src/engine/slots.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { slotsEqual, slotsToString, type Haraka, type Slot } from './slots';

const s = (letter: string, haraka: Haraka | null, shadda = false): Slot => ({ letter, shadda, haraka });
const F = 'َ', D = 'ُ', K = 'ِ', S = 'ْ', SH = 'ّ';

const mutate = (slots: Slot[], i: number, patch: Partial<Slot>): Slot[] =>
  slots.map((x, j) => (j === i ? { ...x, ...patch } : { ...x }));

const hum: Slot[] = [s('ن', 'fatha'), s('ص', 'fatha'), s('ر', 'damma'), s('و', null), s('ا', null)];
const antum: Slot[] = [s('ن', 'fatha'), s('ص', 'fatha'), s('ر', 'sukun'), s('ت', 'damma'), s('م', 'sukun')];
const antunna: Slot[] = [s('ن', 'fatha'), s('ص', 'fatha'), s('ر', 'sukun'), s('ت', 'damma'), s('ن', 'fatha', true)];
const huwa: Slot[] = [s('ن', 'fatha'), s('ص', 'fatha'), s('ر', 'fatha')];

describe('slotsToString', () => {
  it('буква → шадда → огласовка; буквы удлинения без знаков', () => {
    expect(slotsToString(antunna)).toBe(`ن${F}ص${F}ر${S}ت${D}ن${SH}${F}`);
    expect(slotsToString(hum)).toBe(`ن${F}ص${F}ر${D}وا`);
    expect(slotsToString(antum)).toBe(`ن${F}ص${F}ر${S}ت${D}م${S}`);
    expect(slotsToString([])).toBe('');
  });

  it('не нормализует: порядок ТЗ п. 6 отличается от NFC', () => {
    const str = slotsToString(antunna);
    expect(str.normalize('NFC')).not.toBe(str);
    expect(str.normalize('NFC')).toBe(`ن${F}ص${F}ر${S}ت${D}ن${F}${SH}`);
  });
});

describe('slotsEqual', () => {
  it('равные массивы равны, исходные не меняются', () => {
    expect(slotsEqual(antunna, antunna.map((x) => ({ ...x })))).toBe(true);
    expect(slotsEqual([], [])).toBe(true);
  });

  it('разная длина', () => {
    expect(slotsEqual(huwa, huwa.slice(0, 2))).toBe(false);
    expect(slotsEqual(huwa, [])).toBe(false);
  });

  it('пропущенный сукун', () => {
    expect(slotsEqual(antum, mutate(antum, 4, { haraka: null }))).toBe(false);
  });

  it('лишний сукун', () => {
    expect(slotsEqual(huwa, mutate(huwa, 2, { haraka: 'sukun' }))).toBe(false);
  });

  it('сукун на букве удлинения', () => {
    expect(slotsEqual(hum, mutate(hum, 3, { haraka: 'sukun' }))).toBe(false);
    expect(slotsEqual(hum, mutate(hum, 4, { haraka: 'sukun' }))).toBe(false);
  });

  it('шадда не на той букве / пропущена / лишняя', () => {
    expect(slotsEqual(antunna, mutate(mutate(antunna, 4, { shadda: false }), 3, { shadda: true }))).toBe(false);
    expect(slotsEqual(antunna, mutate(antunna, 4, { shadda: false }))).toBe(false);
    expect(slotsEqual(antum, mutate(antum, 4, { shadda: true }))).toBe(false);
  });

  it('другая огласовка и другая буква', () => {
    expect(slotsEqual(antum, mutate(antum, 3, { haraka: 'kasra' }))).toBe(false);
    expect(slotsEqual(antum, mutate(antum, 3, { letter: 'ن' }))).toBe(false);
  });
});
```

- [ ] **Шаг 3: Запуск, ожидаем FAIL**

Run: `npx vitest run src/engine/slots.test.ts`
Expected: FAIL (модуль `./slots` не найден).

- [ ] **Шаг 4: Реализация** `src/engine/slots.ts`

```ts
export type Haraka = 'fatha' | 'damma' | 'kasra' | 'sukun';

export interface Slot {
  letter: string;
  shadda: boolean;
  haraka: Haraka | null;
}

const SHADDA = 'ّ';
const HARAKA_CHAR: Record<Haraka, string> = {
  fatha: 'َ',
  damma: 'ُ',
  kasra: 'ِ',
  sukun: 'ْ',
};

// Порядок символов: буква → шадда → огласовка (ТЗ п. 6). Нормализация NFC не применяется.
export function slotsToString(slots: Slot[]): string {
  return slots
    .map((s) => s.letter + (s.shadda ? SHADDA : '') + (s.haraka ? HARAKA_CHAR[s.haraka] : ''))
    .join('');
}

export function slotsEqual(a: Slot[], b: Slot[]): boolean {
  return (
    a.length === b.length &&
    a.every((s, i) => s.letter === b[i].letter && s.shadda === b[i].shadda && s.haraka === b[i].haraka)
  );
}
```

- [ ] **Шаг 5: Запуск, ожидаем PASS**

Run: `npm test` и `npx tsc --noEmit`
Expected: все тесты `slots.test.ts` зелёные, `tsc` без ошибок.

---

### Задача 2: `paradigm.json`, `paradigm.ts` и тест структуры

**Files:**
- Create: `src/data/paradigm.json`, `src/engine/paradigm.ts`
- Test: `src/engine/paradigm.test.ts`

**Interfaces:**
- Consumes: `Haraka`, `Slot` из `./slots`.
- Produces: `PronounId`, `RuleId = PronounId | 'huwa'`, `SourceRef { role; book; author?; edition; entry?; section?; volume?; page }`, `Rule { id: RuleId; r3Haraka: Haraka; suffix: Slot[]; sources: SourceRef[] }`, `Convention { id: string; text: string; sources: SourceRef[] }`, `Paradigm { rules: Rule[]; conventions: Convention[] }`, `Verb`, `paradigm: Paradigm`, `ruleFor(id: RuleId): Rule`.

- [ ] **Шаг 1: Падающий тест** `src/engine/paradigm.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { paradigm } from './paradigm';

const RULE_IDS = ['huwa', 'hum', 'hiya', 'hunna', 'anta', 'antum', 'anti', 'antunna', 'ana', 'nahnu'];
const CONVENTION_IDS = ['stem', 'no-sign-on-madd-letters', 'other-letters-vowelled'];
const entries = [...paradigm.rules, ...paradigm.conventions];

describe('paradigm.json: структура', () => {
  it('10 правил в порядке п. 4 и 3 соглашения', () => {
    expect(paradigm.rules.map((r) => r.id)).toEqual(RULE_IDS);
    expect(paradigm.conventions.map((c) => c.id)).toEqual(CONVENTION_IDS);
  });

  it('у каждой записи есть место под основной источник, роли допустимы', () => {
    for (const e of entries) {
      expect(e.sources.some((x) => x.role === 'primary'), e.id).toBe(true);
      for (const x of e.sources) expect(['primary', 'check'], e.id).toContain(x.role);
    }
  });

  it('haraka null только у букв удлинения (و и ا)', () => {
    for (const r of paradigm.rules)
      for (const sl of r.suffix) expect(sl.haraka === null, r.id).toBe(sl.letter === 'و' || sl.letter === 'ا');
  });

  it('шадда только в окончании antunna', () => {
    const withShadda = paradigm.rules.filter((r) => r.suffix.some((sl) => sl.shadda)).map((r) => r.id);
    expect(withShadda).toEqual(['antunna']);
  });
});
```

- [ ] **Шаг 2: Запуск, ожидаем FAIL**

Run: `npx vitest run src/engine/paradigm.test.ts`
Expected: FAIL (нет модуля `./paradigm`).

- [ ] **Шаг 3: Данные** `src/data/paradigm.json`

Пустые только `edition`, `section`, `page`. Названия книг и авторы взяты из ТЗ п. 3 и примера п. 5.

```json
{
  "rules": [
    {
      "id": "huwa", "r3Haraka": "fatha", "suffix": [],
      "sources": [
        { "role": "primary", "book": "شذا العرف في فن الصرف", "author": "الحملاوي", "edition": "", "section": "", "page": "" },
        { "role": "check", "book": "A Grammar of the Arabic Language", "author": "W. Wright", "edition": "", "section": "", "page": "" }
      ]
    },
    {
      "id": "hum", "r3Haraka": "damma",
      "suffix": [
        { "letter": "و", "shadda": false, "haraka": null },
        { "letter": "ا", "shadda": false, "haraka": null }
      ],
      "sources": [
        { "role": "primary", "book": "شذا العرف في فن الصرف", "author": "الحملاوي", "edition": "", "section": "", "page": "" },
        { "role": "check", "book": "A Grammar of the Arabic Language", "author": "W. Wright", "edition": "", "section": "", "page": "" }
      ]
    },
    {
      "id": "hiya", "r3Haraka": "fatha",
      "suffix": [{ "letter": "ت", "shadda": false, "haraka": "sukun" }],
      "sources": [
        { "role": "primary", "book": "شذا العرف في فن الصرف", "author": "الحملاوي", "edition": "", "section": "", "page": "" },
        { "role": "check", "book": "A Grammar of the Arabic Language", "author": "W. Wright", "edition": "", "section": "", "page": "" }
      ]
    },
    {
      "id": "hunna", "r3Haraka": "sukun",
      "suffix": [{ "letter": "ن", "shadda": false, "haraka": "fatha" }],
      "sources": [
        { "role": "primary", "book": "شذا العرف في فن الصرف", "author": "الحملاوي", "edition": "", "section": "", "page": "" },
        { "role": "check", "book": "A Grammar of the Arabic Language", "author": "W. Wright", "edition": "", "section": "", "page": "" }
      ]
    },
    {
      "id": "anta", "r3Haraka": "sukun",
      "suffix": [{ "letter": "ت", "shadda": false, "haraka": "fatha" }],
      "sources": [
        { "role": "primary", "book": "شذا العرف في فن الصرف", "author": "الحملاوي", "edition": "", "section": "", "page": "" },
        { "role": "check", "book": "A Grammar of the Arabic Language", "author": "W. Wright", "edition": "", "section": "", "page": "" }
      ]
    },
    {
      "id": "antum", "r3Haraka": "sukun",
      "suffix": [
        { "letter": "ت", "shadda": false, "haraka": "damma" },
        { "letter": "م", "shadda": false, "haraka": "sukun" }
      ],
      "sources": [
        { "role": "primary", "book": "شذا العرف في فن الصرف", "author": "الحملاوي", "edition": "", "section": "", "page": "" },
        { "role": "check", "book": "A Grammar of the Arabic Language", "author": "W. Wright", "edition": "", "section": "", "page": "" }
      ]
    },
    {
      "id": "anti", "r3Haraka": "sukun",
      "suffix": [{ "letter": "ت", "shadda": false, "haraka": "kasra" }],
      "sources": [
        { "role": "primary", "book": "شذا العرف في فن الصرف", "author": "الحملاوي", "edition": "", "section": "", "page": "" },
        { "role": "check", "book": "A Grammar of the Arabic Language", "author": "W. Wright", "edition": "", "section": "", "page": "" }
      ]
    },
    {
      "id": "antunna", "r3Haraka": "sukun",
      "suffix": [
        { "letter": "ت", "shadda": false, "haraka": "damma" },
        { "letter": "ن", "shadda": true, "haraka": "fatha" }
      ],
      "sources": [
        { "role": "primary", "book": "شذا العرف في فن الصرف", "author": "الحملاوي", "edition": "", "section": "", "page": "" },
        { "role": "check", "book": "A Grammar of the Arabic Language", "author": "W. Wright", "edition": "", "section": "", "page": "" }
      ]
    },
    {
      "id": "ana", "r3Haraka": "sukun",
      "suffix": [{ "letter": "ت", "shadda": false, "haraka": "damma" }],
      "sources": [
        { "role": "primary", "book": "شذا العرف في فن الصرف", "author": "الحملاوي", "edition": "", "section": "", "page": "" },
        { "role": "check", "book": "A Grammar of the Arabic Language", "author": "W. Wright", "edition": "", "section": "", "page": "" }
      ]
    },
    {
      "id": "nahnu", "r3Haraka": "sukun",
      "suffix": [
        { "letter": "ن", "shadda": false, "haraka": "fatha" },
        { "letter": "ا", "shadda": false, "haraka": null }
      ],
      "sources": [
        { "role": "primary", "book": "شذا العرف في فن الصرف", "author": "الحملاوي", "edition": "", "section": "", "page": "" },
        { "role": "check", "book": "A Grammar of the Arabic Language", "author": "W. Wright", "edition": "", "section": "", "page": "" }
      ]
    }
  ],
  "conventions": [
    {
      "id": "stem",
      "text": "Основа одинакова во всех формах: R1 + фатха, R2 + огласовка V2 из словаря",
      "sources": [
        { "role": "primary", "book": "شذا العرف في فن الصرف", "author": "الحملاوي", "edition": "", "section": "", "page": "" },
        { "role": "check", "book": "A Grammar of the Arabic Language", "author": "W. Wright", "edition": "", "section": "", "page": "" }
      ]
    },
    {
      "id": "no-sign-on-madd-letters",
      "text": "Буквы удлинения (و и ا в форме hum, ا в форме nahnu) пишутся без сукуна и без какого-либо знака",
      "sources": [
        { "role": "primary", "book": "شذا العرف في فن الصرف", "author": "الحملاوي", "edition": "", "section": "", "page": "" },
        { "role": "check", "book": "A Grammar of the Arabic Language", "author": "W. Wright", "edition": "", "section": "", "page": "" }
      ]
    },
    {
      "id": "other-letters-vowelled",
      "text": "Все остальные буквы огласованы обязательно, включая сукун на конце; шадда встречается только в окончании формы antunna",
      "sources": [
        { "role": "primary", "book": "شذا العرف في فن الصرف", "author": "الحملاوي", "edition": "", "section": "", "page": "" },
        { "role": "check", "book": "A Grammar of the Arabic Language", "author": "W. Wright", "edition": "", "section": "", "page": "" }
      ]
    }
  ]
}
```

- [ ] **Шаг 4: Типы и загрузка** `src/engine/paradigm.ts`

```ts
import raw from '../data/paradigm.json';
import type { Haraka, Slot } from './slots';

export type PronounId = 'hum' | 'hiya' | 'hunna' | 'anta' | 'antum' | 'anti' | 'antunna' | 'ana' | 'nahnu';
export type RuleId = PronounId | 'huwa';

export interface SourceRef {
  role: 'primary' | 'check';
  book: string;
  author?: string;
  edition: string;
  entry?: string;
  section?: string;
  volume?: string;
  page: string;
}

export interface Rule {
  id: RuleId;
  r3Haraka: Haraka;
  suffix: Slot[];
  sources: SourceRef[];
}

export interface Convention {
  id: string;
  text: string;
  sources: SourceRef[];
}

export interface Paradigm {
  rules: Rule[];
  conventions: Convention[];
}

export interface Verb {
  id: string;
  root: [string, string, string];
  midVowel: 'fatha' | 'kasra' | 'damma';
  sources: SourceRef[];
  verified: boolean;
}

export const paradigm = raw as unknown as Paradigm;

export function ruleFor(id: RuleId): Rule {
  return paradigm.rules.find((r) => r.id === id)!;
}
```

- [ ] **Шаг 5: Запуск, ожидаем PASS**

Run: `npm test` и `npx tsc --noEmit`
Expected: `paradigm.test.ts` зелёный, `tsc` без ошибок.

---

### Задача 3: `conjugate.ts` и golden-тесты

**Files:**
- Create: `src/engine/conjugate.ts`
- Test: `src/engine/conjugate.test.ts`

**Interfaces:**
- Consumes: `Slot`, `Haraka`, `slotsToString`, `slotsEqual` (slots); `Verb`, `RuleId`, `PronounId`, `ruleFor` (paradigm).
- Produces: `conjugatePast(verb: Verb, p: PronounId | 'huwa'): Slot[]`.

- [ ] **Шаг 1: Падающий тест** `src/engine/conjugate.test.ts`

Эталон записан массивами слотов: основа глагола + «хвост» (огласовка R3 и окончание) для каждого из 10 id. Строки собираются из констант Unicode. Любую форму перед запуском владелец сверяет с источниками.

```ts
import { describe, expect, it } from 'vitest';
import { conjugatePast } from './conjugate';
import type { RuleId, Verb } from './paradigm';
import { slotsEqual, slotsToString, type Haraka, type Slot } from './slots';

const s = (letter: string, haraka: Haraka | null, shadda = false): Slot => ({ letter, shadda, haraka });
const F = 'َ', D = 'ُ', K = 'ِ', S = 'ْ', SH = 'ّ';

const IDS: RuleId[] = ['huwa', 'hum', 'hiya', 'hunna', 'anta', 'antum', 'anti', 'antunna', 'ana', 'nahnu'];

// Огласовка R3 и окончание (ТЗ п. 5), по id
const tail: Record<RuleId, { r3: Haraka; suffix: Slot[] }> = {
  huwa: { r3: 'fatha', suffix: [] },
  hum: { r3: 'damma', suffix: [s('و', null), s('ا', null)] },
  hiya: { r3: 'fatha', suffix: [s('ت', 'sukun')] },
  hunna: { r3: 'sukun', suffix: [s('ن', 'fatha')] },
  anta: { r3: 'sukun', suffix: [s('ت', 'fatha')] },
  antum: { r3: 'sukun', suffix: [s('ت', 'damma'), s('م', 'sukun')] },
  anti: { r3: 'sukun', suffix: [s('ت', 'kasra')] },
  antunna: { r3: 'sukun', suffix: [s('ت', 'damma'), s('ن', 'fatha', true)] },
  ana: { r3: 'sukun', suffix: [s('ت', 'damma')] },
  nahnu: { r3: 'sukun', suffix: [s('ن', 'fatha'), s('ا', null)] },
};

const tailStr: Record<RuleId, string> = {
  huwa: F,
  hum: `${D}وا`,
  hiya: `${F}ت${S}`,
  hunna: `${S}ن${F}`,
  anta: `${S}ت${F}`,
  antum: `${S}ت${D}م${S}`,
  anti: `${S}ت${K}`,
  antunna: `${S}ت${D}ن${SH}${F}`,
  ana: `${S}ت${D}`,
  nahnu: `${S}ن${F}ا`,
};

const mk = (id: string, root: [string, string, string], midVowel: Verb['midVowel']): Verb => ({
  id,
  root,
  midVowel,
  sources: [],
  verified: false,
});

// نَصَرَ, سَمِعَ, كَرُمَ
const golden = [
  { verb: mk('nasara', ['ن', 'ص', 'ر'], 'fatha'), stem: [s('ن', 'fatha'), s('ص', 'fatha')], stemStr: `ن${F}ص${F}`, r3: 'ر' },
  { verb: mk('sami3a', ['س', 'م', 'ع'], 'kasra'), stem: [s('س', 'fatha'), s('م', 'kasra')], stemStr: `س${F}م${K}`, r3: 'ع' },
  { verb: mk('karuma', ['ك', 'ر', 'م'], 'damma'), stem: [s('ك', 'fatha'), s('ر', 'damma')], stemStr: `ك${F}ر${D}`, r3: 'م' },
];

describe('conjugatePast: golden (ТЗ п. 10)', () => {
  for (const g of golden) {
    for (const id of IDS) {
      const p = id;
      it(`${g.verb.id} / ${id}: Slot[]`, () => {
        const expected = [...g.stem, s(g.r3, tail[id].r3), ...tail[id].suffix];
        const actual = conjugatePast(g.verb, p);
        expect(actual).toEqual(expected);
        expect(slotsEqual(actual, expected)).toBe(true);
      });

      it(`${g.verb.id} / ${id}: строка`, () => {
        expect(slotsToString(conjugatePast(g.verb, p))).toBe(g.stemStr + g.r3 + tailStr[id]);
      });
    }
  }

  it('литеральные эталоны (независимо от таблиц выше)', () => {
    const nasara = golden[0].verb;
    expect(conjugatePast(nasara, 'antunna')).toEqual([
      s('ن', 'fatha'), s('ص', 'fatha'), s('ر', 'sukun'), s('ت', 'damma'), s('ن', 'fatha', true),
    ]);
    expect(conjugatePast(nasara, 'hum')).toEqual([
      s('ن', 'fatha'), s('ص', 'fatha'), s('ر', 'damma'), s('و', null), s('ا', null),
    ]);
    expect(conjugatePast(nasara, 'nahnu')).toEqual([
      s('ن', 'fatha'), s('ص', 'fatha'), s('ر', 'sukun'), s('ن', 'fatha'), s('ا', null),
    ]);
  });
});

describe('conjugatePast: входы вне таблицы', () => {
  it('буква корня = буква окончания: слияния нет (كتب, anta)', () => {
    const kataba = mk('kataba', ['ك', 'ت', 'ب'], 'fatha');
    expect(conjugatePast(kataba, 'anta')).toEqual([
      s('ك', 'fatha'), s('ت', 'fatha'), s('ب', 'sukun'), s('ت', 'fatha'),
    ]);
    const nasara = golden[0].verb;
    expect(conjugatePast(nasara, 'nahnu').filter((x) => x.letter === 'ن')).toHaveLength(2);
  });

  it('результат не делит объекты с paradigm.json', () => {
    const nasara = golden[0].verb;
    const first = conjugatePast(nasara, 'antunna');
    first[3].haraka = 'kasra';
    first[4].shadda = false;
    expect(conjugatePast(nasara, 'antunna')[3]).toEqual(s('ت', 'damma'));
    expect(conjugatePast(nasara, 'antunna')[4]).toEqual(s('ن', 'fatha', true));
  });
});
```

- [ ] **Шаг 2: Запуск, ожидаем FAIL**

Run: `npx vitest run src/engine/conjugate.test.ts`
Expected: FAIL (нет модуля `./conjugate`).

- [ ] **Шаг 3: Реализация** `src/engine/conjugate.ts`

```ts
import { ruleFor, type PronounId, type Verb } from './paradigm';
import type { Slot } from './slots';

// Основа: R1 + фатха, R2 + V2. Затем R3 с огласовкой правила и окончание из paradigm.json.
export function conjugatePast(verb: Verb, p: PronounId | 'huwa'): Slot[] {
  const rule = ruleFor(p);
  const [r1, r2, r3] = verb.root;
  return [
    { letter: r1, shadda: false, haraka: 'fatha' },
    { letter: r2, shadda: false, haraka: verb.midVowel },
    { letter: r3, shadda: false, haraka: rule.r3Haraka },
    ...rule.suffix.map((sl) => ({ ...sl })),
  ];
}
```

- [ ] **Шаг 4: Запуск, ожидаем PASS**

Run: `npm test` и `npx tsc --noEmit`
Expected: все тесты зелёные (60 golden плюс 3 прочих), `tsc` без ошибок. Показать вывод.

---

### Задача 4: `validateVerb`

**Files:**
- Create: `src/engine/validate.ts`
- Test: `src/engine/validate.test.ts`

**Interfaces:**
- Consumes: `Verb` (paradigm).
- Produces: `type VerbIssue = 'ROOT_LENGTH' | 'FORBIDDEN_LETTER' | 'GEMINATE' | 'R3_T_OR_N' | 'NOT_BASE_LETTER' | 'BAD_MID_VOWEL' | 'NO_PRIMARY_DICTIONARY' | 'NOT_VERIFIED'` (пункты 1–8 п. 7 по порядку); `validateVerb(input: unknown): VerbIssue[]` (пустой массив = валиден).

- [ ] **Шаг 1: Падающий тест** `src/engine/validate.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { validateVerb } from './validate';

// Фикстуры: значения TEST-… не являются реальными ссылками
const dict = { role: 'primary', book: 'المعجم الوسيط', entry: 'TEST-ENTRY', edition: 'TEST-EDITION', page: 'TEST-PAGE' };
const base = { id: 't', root: ['ن', 'ص', 'ر'], midVowel: 'fatha', sources: [dict], verified: true };
const v = (patch: Record<string, unknown>) => ({ ...base, ...patch });

describe('validateVerb', () => {
  it('валидные глаголы', () => {
    expect(validateVerb(base)).toEqual([]);
    expect(validateVerb(v({ root: ['س', 'م', 'ع'], midVowel: 'kasra' }))).toEqual([]);
    expect(validateVerb(v({ root: ['ك', 'ر', 'م'], midVowel: 'damma' }))).toEqual([]);
  });

  it.each([
    ['قال (قول)', ['ق', 'و', 'ل']],
    ['دعا (دعو)', ['د', 'ع', 'و']],
    ['وعد', ['و', 'ع', 'د']],
    ['أكل', ['أ', 'ك', 'ل']],
  ])('п. 2: %s', (_n, root) => {
    expect(validateVerb(v({ root }))).toEqual(['FORBIDDEN_LETTER']);
  });

  it('п. 3: مدّ (مدد), удвоенный', () => {
    expect(validateVerb(v({ root: ['م', 'د', 'د'] }))).toEqual(['GEMINATE']);
  });

  it.each([
    ['سكت', ['س', 'ك', 'ت']],
    ['سكن', ['س', 'ك', 'ن']],
  ])('п. 4: %s', (_n, root) => {
    expect(validateVerb(v({ root }))).toEqual(['R3_T_OR_N']);
  });

  it('п. 1: не три буквы', () => {
    expect(validateVerb(v({ root: ['ن', 'ص'] }))).toEqual(['ROOT_LENGTH']);
    expect(validateVerb(v({ root: ['ن', 'ص', 'ر', 'ك'] }))).toEqual(['ROOT_LENGTH']);
  });

  it('п. 5: не базовая буква', () => {
    expect(validateVerb(v({ root: ['نَ', 'ص', 'ر'] }))).toEqual(['NOT_BASE_LETTER']);
    expect(validateVerb(v({ root: ['ـ', 'ص', 'ر'] }))).toEqual(['NOT_BASE_LETTER']);
    expect(validateVerb(v({ root: ['ن', 'ص', 'ػ'] }))).toEqual(['NOT_BASE_LETTER']);
    expect(validateVerb(v({ root: ['a', 'ص', 'ر'] }))).toEqual(['NOT_BASE_LETTER']);
  });

  it('п. 6: midVowel', () => {
    expect(validateVerb(v({ midVowel: 'sukun' }))).toEqual(['BAD_MID_VOWEL']);
    expect(validateVerb(v({ midVowel: undefined }))).toEqual(['BAD_MID_VOWEL']);
  });

  it('п. 7: нужен основной словарь с заполненными book, entry, edition, page', () => {
    expect(validateVerb(v({ sources: [] }))).toEqual(['NO_PRIMARY_DICTIONARY']);
    expect(validateVerb(v({ sources: [{ ...dict, role: 'check' }] }))).toEqual(['NO_PRIMARY_DICTIONARY']);
    expect(validateVerb(v({ sources: [{ ...dict, page: '' }] }))).toEqual(['NO_PRIMARY_DICTIONARY']);
    expect(validateVerb(v({ sources: [{ ...dict, entry: undefined }] }))).toEqual(['NO_PRIMARY_DICTIONARY']);
  });

  it('п. 7: поля из одних пробелов считаются пустыми', () => {
    expect(validateVerb(v({ sources: [{ ...dict, edition: '   ' }] }))).toEqual(['NO_PRIMARY_DICTIONARY']);
  });

  it('п. 7: достаточно одного заполненного основного среди нескольких', () => {
    expect(validateVerb(v({ sources: [{ ...dict, role: 'check' }, dict] }))).toEqual([]);
  });

  it('п. 8: verified', () => {
    expect(validateVerb(v({ verified: false }))).toEqual(['NOT_VERIFIED']);
    expect(validateVerb(v({ verified: 'true' }))).toEqual(['NOT_VERIFIED']);
  });

  it('несколько нарушений возвращаются все, в порядке пунктов', () => {
    expect(validateVerb(v({ root: ['و', 'د', 'د'], verified: false }))).toEqual([
      'FORBIDDEN_LETTER',
      'GEMINATE',
      'NOT_VERIFIED',
    ]);
  });

  it('мусорный вход не бросает исключение', () => {
    for (const junk of [null, undefined, 'نصر', 42, [], {}, v({ root: 'نصر' }), v({ root: [1, null, {}] }), v({ sources: 'x' }), v({ sources: [null, 3] })]) {
      expect(() => validateVerb(junk)).not.toThrow();
      expect(validateVerb(junk).length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Шаг 2: Запуск, ожидаем FAIL**

Run: `npx vitest run src/engine/validate.test.ts`
Expected: FAIL (нет модуля `./validate`).

- [ ] **Шаг 3: Реализация** `src/engine/validate.ts`

```ts
export type VerbIssue =
  | 'ROOT_LENGTH'
  | 'FORBIDDEN_LETTER'
  | 'GEMINATE'
  | 'R3_T_OR_N'
  | 'NOT_BASE_LETTER'
  | 'BAD_MID_VOWEL'
  | 'NO_PRIMARY_DICTIONARY'
  | 'NOT_VERIFIED';

// و ي ا ى ء أ إ ؤ ئ آ ة
const FORBIDDEN_LETTERS = new Set(Array.from('وياىءأإؤئآة'));
const TA = 'ت';
const NUN = 'ن';
const MID_VOWELS = ['fatha', 'kasra', 'damma'];

export const filled = (x: unknown): boolean => typeof x === 'string' && x.trim() !== '';

// Базовая арабская буква U+0621–U+064A, кроме татвиля U+0640 и неназначенных U+063B–U+063F
function isBaseLetter(x: unknown): boolean {
  if (typeof x !== 'string' || x.length !== 1) return false;
  const c = x.charCodeAt(0);
  return c >= 0x0621 && c <= 0x064a && c !== 0x0640 && !(c >= 0x063b && c <= 0x063f);
}

export function hasFilledPrimary(sources: unknown, fields: string[]): boolean {
  return (
    Array.isArray(sources) &&
    sources.some((src) => {
      if (src === null || typeof src !== 'object') return false;
      const r = src as Record<string, unknown>;
      return r.role === 'primary' && fields.every((f) => filled(r[f]));
    })
  );
}

export function validateVerb(input: unknown): VerbIssue[] {
  const v = (input !== null && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const root: unknown[] = Array.isArray(v.root) ? v.root : [];
  const issues: VerbIssue[] = [];

  if (!Array.isArray(v.root) || v.root.length !== 3) issues.push('ROOT_LENGTH');
  if (root.some((l) => typeof l === 'string' && FORBIDDEN_LETTERS.has(l))) issues.push('FORBIDDEN_LETTER');
  if (root[1] !== undefined && root[1] === root[2]) issues.push('GEMINATE');
  if (root[2] === TA || root[2] === NUN) issues.push('R3_T_OR_N');
  if (root.some((l) => !isBaseLetter(l))) issues.push('NOT_BASE_LETTER');
  if (!MID_VOWELS.includes(v.midVowel as string)) issues.push('BAD_MID_VOWEL');
  if (!hasFilledPrimary(v.sources, ['book', 'entry', 'edition', 'page'])) issues.push('NO_PRIMARY_DICTIONARY');
  if (v.verified !== true) issues.push('NOT_VERIFIED');

  return issues;
}
```

- [ ] **Шаг 4: Запуск, ожидаем PASS**

Run: `npm test` и `npx tsc --noEmit`
Expected: все тесты зелёные. Если красный `мусорный вход`, исправить `validateVerb`, а не тест.

---

### Задача 5: `filterVerbs`, `validateParadigm`, `verbs.json` и тесты данных

**Files:**
- Modify: `src/engine/validate.ts` (добавить `filterVerbs`, `validateParadigm`)
- Modify: `src/engine/validate.test.ts` (добавить тесты в конец)
- Modify: `src/engine/paradigm.test.ts` (добавить тест источников)
- Create: `src/data/verbs.json`
- Test: `src/engine/verbs.test.ts`

**Interfaces:**
- Consumes: `validateVerb`, `hasFilledPrimary` (validate); `paradigm`, `Paradigm`, `Verb` (paradigm).
- Produces: `filterVerbs(raw: unknown[]): { valid: Verb[]; rejected: { verb: unknown; issues: VerbIssue[] }[] }`; `validateParadigm(p?: Paradigm): string[]` (id записей без заполненного основного источника с `book`, `edition`, `section`, `page`; пустой массив = всё заполнено).

- [ ] **Шаг 1: Падающие тесты**

Добавить в начало `src/engine/validate.test.ts` импорты и в конец файла блоки. Импорт `import { validateVerb } from './validate';` заменить на:

```ts
import { filterVerbs, validateParadigm, validateVerb } from './validate';
import type { Paradigm } from './paradigm';
```

В конец `src/engine/validate.test.ts`:

```ts
describe('filterVerbs', () => {
  it('разделяет валидные и отклонённые с причинами', () => {
    const bad = v({ verified: false });
    const { valid, rejected } = filterVerbs([base, bad]);
    expect(valid).toEqual([base]);
    expect(rejected).toEqual([{ verb: bad, issues: ['NOT_VERIFIED'] }]);
  });

  it('пустой массив', () => {
    expect(filterVerbs([])).toEqual({ valid: [], rejected: [] });
  });
});

describe('validateParadigm', () => {
  const full = { role: 'primary', book: 'TEST-BOOK', edition: 'TEST-EDITION', section: 'TEST-SECTION', page: 'TEST-PAGE' };
  const mk = (sources: unknown[]): Paradigm =>
    ({
      rules: [{ id: 'huwa', r3Haraka: 'fatha', suffix: [], sources }],
      conventions: [{ id: 'stem', text: 'x', sources: [full] }],
    }) as unknown as Paradigm;

  it('всё заполнено', () => {
    expect(validateParadigm(mk([full]))).toEqual([]);
  });

  it('возвращает id записи без заполненного основного источника', () => {
    expect(validateParadigm(mk([]))).toEqual(['huwa']);
    expect(validateParadigm(mk([{ ...full, section: '' }]))).toEqual(['huwa']);
    expect(validateParadigm(mk([{ ...full, page: '  ' }]))).toEqual(['huwa']);
    expect(validateParadigm(mk([{ ...full, role: 'check' }]))).toEqual(['huwa']);
  });

  it('основной источник среди нескольких', () => {
    expect(validateParadigm(mk([{ ...full, role: 'check' }, full]))).toEqual([]);
  });
});
```

В `src/engine/paradigm.test.ts` добавить импорт `import { validateParadigm } from './validate';` и в конец файла:

```ts
describe('paradigm.json: источники', () => {
  // Красный, пока владелец не заполнит ссылки (ТЗ п. 12, этап 1). В сообщении об ошибке видны id записей.
  it('у каждого правила и соглашения заполнен основной источник (book, edition, section, page)', () => {
    expect(validateParadigm()).toEqual([]);
  });
});
```

Создать `src/engine/verbs.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import verbs from '../data/verbs.json';
import { filterVerbs } from './validate';

describe('verbs.json', () => {
  it('это массив', () => {
    expect(Array.isArray(verbs)).toBe(true);
  });

  it('нет невалидных записей среди verified: true', () => {
    const { rejected } = filterVerbs(verbs as unknown[]);
    const broken = rejected.filter((r) => (r.verb as { verified?: unknown }).verified === true);
    expect(broken).toEqual([]);
  });
});
```

- [ ] **Шаг 2: Запуск, ожидаем FAIL**

Run: `npm test`
Expected: FAIL (нет `filterVerbs`/`validateParadigm`, нет `verbs.json`).

- [ ] **Шаг 3: Данные** `src/data/verbs.json`

Пример непроверен; пустые `edition`, `page`, `volume`.

```json
[
  {
    "id": "nasara",
    "root": ["ن", "ص", "ر"],
    "midVowel": "fatha",
    "sources": [
      { "role": "primary", "book": "المعجم الوسيط", "entry": "نصر", "edition": "", "volume": "", "page": "" }
    ],
    "verified": false
  }
]
```

- [ ] **Шаг 4: Реализация**

В начало `src/engine/validate.ts` добавить:

```ts
import { paradigm as defaultParadigm, type Paradigm, type Verb } from './paradigm';
```

В конец `src/engine/validate.ts`:

```ts
export interface RejectedVerb {
  verb: unknown;
  issues: VerbIssue[];
}

// Предупреждения в консоль выводит вызывающий слой (UI), не движок.
export function filterVerbs(raw: unknown[]): { valid: Verb[]; rejected: RejectedVerb[] } {
  const valid: Verb[] = [];
  const rejected: RejectedVerb[] = [];
  for (const verb of raw) {
    const issues = validateVerb(verb);
    if (issues.length === 0) valid.push(verb as Verb);
    else rejected.push({ verb, issues });
  }
  return { valid, rejected };
}

const RULE_SOURCE_FIELDS = ['book', 'edition', 'section', 'page'];

// id правил и соглашений без заполненного основного источника
export function validateParadigm(p: Paradigm = defaultParadigm): string[] {
  return [...p.rules, ...p.conventions]
    .filter((e) => !hasFilledPrimary(e.sources, RULE_SOURCE_FIELDS))
    .map((e) => e.id);
}
```

- [ ] **Шаг 5: Запуск**

Run: `npm test` и `npx tsc --noEmit`
Expected: всё зелёное, кроме одного теста `paradigm.json: источники`, он красный, ошибка перечисляет 13 id: huwa, hum, hiya, hunna, anta, antum, anti, antunna, ana, nahnu, stem, no-sign-on-madd-letters, other-letters-vowelled. `tsc` без ошибок.

---

### Задача 6: итоговая проверка и остановка

- [ ] **Шаг 1:** Запустить `npm test` и `npx tsc --noEmit`, вставить в ответ полный вывод.
- [ ] **Шаг 2:** Сверить с критериями этапа: golden 30 форм зелёные; `slotsEqual` отклоняет отличия в один знак; валидатор отклоняет примеры п. 10; красный ровно один тест (источники), и он перечисляет 13 id.
- [ ] **Шаг 3:** Остановиться и показать результат владельцу. Напомнить: (а) заполнить `edition`, `section`, `page` в `paradigm.json`; (б) исправить строку `antunna` в таблице п. 10 ТЗ (порядок знаков); (в) перед этапом 2 сверить 30 эталонных форм с источниками. К этапу 2 не переходить без команды.
