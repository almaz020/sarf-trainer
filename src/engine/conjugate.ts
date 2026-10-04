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
