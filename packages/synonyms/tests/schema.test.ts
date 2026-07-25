import { describe, expect, test } from 'vitest';
import { loadDictionary, validateDictionary } from '../src/index.ts';

describe('validateDictionary', () => {
  test('accepts a well-formed dictionary', () => {
    const input = [
      { term: 'home', expansion: 'house', lang: 'en' },
      { term: 'カート', expansion: 'cart', lang: 'ja', weight: 0.9 },
    ];
    expect(validateDictionary(input)).toEqual(input);
  });

  test('rejects entries missing required fields', () => {
    expect(() => validateDictionary([{ term: 'x' }])).toThrow(/expansion/);
  });

  test('rejects unknown lang', () => {
    expect(() => validateDictionary([{ term: 'x', expansion: 'y', lang: 'zz' }])).toThrow(/lang/);
  });

  test('rejects non-array input', () => {
    expect(() => validateDictionary({})).toThrow(/array/);
  });
});

describe('loadDictionary', () => {
  test('returns a non-empty Japanese dictionary', () => {
    const dict = loadDictionary('ja');
    expect(dict.length).toBeGreaterThan(0);
    for (const entry of dict) expect(entry.lang).toBe('ja');
  });

  test('returns a non-empty English dictionary', () => {
    const dict = loadDictionary('en');
    expect(dict.length).toBeGreaterThan(0);
    for (const entry of dict) expect(entry.lang).toBe('en');
  });
});
