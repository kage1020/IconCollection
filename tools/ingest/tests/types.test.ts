import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, expectTypeOf, test } from 'vitest';
import type { CollectionSnapshot, IconifyJSON, IngestConfig, IngestReport } from '../src/types.ts';

const readFixture = (name: string): IconifyJSON => {
  const path = fileURLToPath(new URL(`../__fixtures__/${name}`, import.meta.url));
  return JSON.parse(readFileSync(path, 'utf-8')) as IconifyJSON;
};

describe('fixture files', () => {
  test('mdi-mini has 3 icons', () => {
    const body = readFixture('mdi-mini.json');
    expect(body.prefix).toBe('mdi');
    expect(Object.keys(body.icons)).toHaveLength(3);
  });

  test('lucide-mini has 2 icons', () => {
    const body = readFixture('lucide-mini.json');
    expect(body.prefix).toBe('lucide');
    expect(Object.keys(body.icons)).toHaveLength(2);
  });
});

describe('CollectionSnapshot type', () => {
  test('has required fields', () => {
    expectTypeOf<CollectionSnapshot>().toEqualTypeOf<{
      collection: string;
      version: string;
      license: string;
      total: number;
      body: IconifyJSON;
    }>();
  });
});

describe('IngestReport type', () => {
  test('lists changed collections', () => {
    expectTypeOf<IngestReport['collectionsChanged']>().toEqualTypeOf<string[]>();
  });
});

describe('IngestConfig type', () => {
  test('r2 and d1 credentials are required', () => {
    expectTypeOf<IngestConfig['r2']>().toEqualTypeOf<{
      accountId: string;
      accessKeyId: string;
      secretAccessKey: string;
      bucket: string;
    }>();
    expectTypeOf<IngestConfig['d1']>().toEqualTypeOf<{
      apiToken: string;
      accountId: string;
      databaseId: string;
    }>();
  });
});
