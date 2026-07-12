import { expectTypeOf, test } from 'vitest';
import type { IconHit, SearchQuery, SearchResponse } from '../src/index.ts';

test('IconHit has required fields with correct types', () => {
  expectTypeOf<IconHit>().toEqualTypeOf<{
    collection: string;
    name: string;
    license: string;
    width: number;
    height: number;
  }>();
});

test('SearchQuery.q is required, filters are optional', () => {
  expectTypeOf<SearchQuery>().toEqualTypeOf<{
    q: string;
    collection?: string[];
    license?: string[];
    limit?: number;
    cursor?: string;
  }>();
});

test('SearchResponse aggregates hits with total and cursor', () => {
  expectTypeOf<SearchResponse>().toEqualTypeOf<{
    hits: IconHit[];
    total: number;
    cursor: string | null;
  }>();
});
