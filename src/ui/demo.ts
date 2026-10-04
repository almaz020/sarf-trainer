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
