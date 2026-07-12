import { describe, expect, test } from 'vitest';
import { buildFtsQuery, normalizeQuery } from '../src/index.ts';

describe('normalizeQuery', () => {
  test('applies NFKC and trims and lowercases', () => {
    expect(normalizeQuery('  Home  ')).toBe('home');
    expect(normalizeQuery('カート')).toBe('カート');
    expect(normalizeQuery('ABC')).toBe('abc');
  });

  test('collapses full-width alphanumerics to half-width', () => {
    expect(normalizeQuery('Ｈｏｍｅ')).toBe('home');
  });
});

describe('buildFtsQuery', () => {
  test('quotes each term and joins with OR', () => {
    expect(buildFtsQuery(['home', 'house'])).toBe('"home" OR "house"');
  });

  test('strips FTS5 reserved characters', () => {
    expect(buildFtsQuery(['ho*me', 'ho(u)se'])).toBe('"home" OR "house"');
  });

  test('drops empty terms', () => {
    expect(buildFtsQuery(['home', ''])).toBe('"home"');
  });

  test('returns empty string when all terms are dropped', () => {
    expect(buildFtsQuery(['*', ''])).toBe('');
  });
});
