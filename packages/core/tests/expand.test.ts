import type { SynonymDictionary } from '@icon-collection/synonyms';
import { describe, expect, test } from 'vitest';
import { expandQuery } from '../src/index.ts';

const ja: SynonymDictionary = [
  { term: 'カート', expansion: 'cart', lang: 'ja' },
  { term: 'カート', expansion: 'shopping', lang: 'ja' },
];
const en: SynonymDictionary = [
  { term: 'cart', expansion: 'shopping', lang: 'en' },
  { term: 'cart', expansion: 'bag', lang: 'en' },
  { term: 'home', expansion: 'house', lang: 'en' },
];

describe('expandQuery', () => {
  test('returns [] for empty input', () => {
    expect(expandQuery('', [ja, en])).toEqual([]);
    expect(expandQuery('   ', [ja, en])).toEqual([]);
  });

  test('preserves original term when no synonym matches', () => {
    expect(expandQuery('unknown', [ja, en])).toEqual(['unknown']);
  });

  test('expands via a single dictionary', () => {
    const result = expandQuery('カート', [ja]);
    expect(result).toEqual(expect.arrayContaining(['カート', 'cart', 'shopping']));
    expect(result).toHaveLength(3);
  });

  test('merges expansions across multiple dictionaries and dedups', () => {
    const result = expandQuery('cart', [ja, en]);
    expect(result).toEqual(expect.arrayContaining(['cart', 'shopping', 'bag']));
    expect(result).toHaveLength(3);
  });

  test('normalizes input before matching', () => {
    const result = expandQuery('  Cart  ', [en]);
    expect(result).toEqual(expect.arrayContaining(['cart', 'shopping', 'bag']));
  });

  test('handles multi-term queries independently', () => {
    const result = expandQuery('cart home', [en]);
    expect(result).toEqual(expect.arrayContaining(['cart', 'shopping', 'bag', 'home', 'house']));
    // 'home' has house in en dict
  });
});
