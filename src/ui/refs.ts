import type { SourceRef } from '../engine/paradigm';

const has = (v: string | undefined): v is string => v !== undefined && v.trim() !== '';
const join = (parts: (string | undefined)[]) => parts.filter(has).join(', ');

export function primarySource(sources: SourceRef[]): SourceRef | undefined {
  return sources.find((s) => s.role === 'primary');
}

// Формат: «книга, مادة статья, т. том, с. страница»; пустые части опускаются, издание не выводится.
export function formatDictionaryRef(s: SourceRef): string {
  return join([
    s.book,
    has(s.entry) ? `مادة ${s.entry}` : undefined,
    has(s.volume) ? `т. ${s.volume}` : undefined,
    has(s.page) ? `с. ${s.page}` : undefined,
  ]);
}

// Формат: «книга, раздел, с. страница»; только ссылка, без текста правила.
export function formatRuleRef(s: SourceRef): string {
  return join([s.book, s.section, has(s.page) ? `с. ${s.page}` : undefined]);
}
