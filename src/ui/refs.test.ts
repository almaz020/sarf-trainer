import { describe, expect, it } from 'vitest';
import type { SourceRef } from '../engine/paradigm';
import { formatDictionaryRef, formatRuleRef, primarySource } from './refs';

const dict: SourceRef = { role: 'primary', book: 'TEST-BOOK', entry: 'TEST-ENTRY', edition: 'TEST-ED', volume: 'TEST-VOL', page: 'TEST-PAGE' };
const rule: SourceRef = { role: 'primary', book: 'TEST-GRAMMAR', edition: 'TEST-ED', section: 'TEST-SECTION', page: 'TEST-PAGE' };

describe('primarySource', () => {
  it('берёт первый источник с role primary', () => {
    const check: SourceRef = { ...dict, role: 'check', book: 'CHECK' };
    expect(primarySource([check, dict])).toBe(dict);
  });
  it('нет основного источника: undefined', () => {
    expect(primarySource([{ ...dict, role: 'check' }])).toBeUndefined();
    expect(primarySource([])).toBeUndefined();
  });
});

describe('formatDictionaryRef', () => {
  it('книга, статья, том, страница', () => {
    expect(formatDictionaryRef(dict)).toBe('TEST-BOOK, مادة TEST-ENTRY, т. TEST-VOL, с. TEST-PAGE');
  });
  it('пустые и пробельные части опускаются; издание не выводится', () => {
    expect(formatDictionaryRef({ ...dict, volume: '' })).toBe('TEST-BOOK, مادة TEST-ENTRY, с. TEST-PAGE');
    expect(formatDictionaryRef({ ...dict, volume: '   ', page: '' })).toBe('TEST-BOOK, مادة TEST-ENTRY');
    expect(formatDictionaryRef(dict)).not.toContain('TEST-ED');
  });
  it('пустой entry опускается', () => {
    expect(formatDictionaryRef({ ...dict, entry: '' })).toBe('TEST-BOOK, т. TEST-VOL, с. TEST-PAGE');
  });
});

describe('formatRuleRef', () => {
  it('книга, раздел, страница', () => {
    expect(formatRuleRef(rule)).toBe('TEST-GRAMMAR, TEST-SECTION, с. TEST-PAGE');
  });
  it('пустые части опускаются', () => {
    expect(formatRuleRef({ ...rule, section: undefined })).toBe('TEST-GRAMMAR, с. TEST-PAGE');
    expect(formatRuleRef({ ...rule, section: '', page: '' })).toBe('TEST-GRAMMAR');
  });
});
