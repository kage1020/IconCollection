import type { SynonymDictionary } from '@icon-collection/synonyms';
import { describe, expect, test, vi } from 'vitest';
import type { D1Client, D1Result } from '../src/d1.ts';
import { seedSynonyms } from '../src/seed-synonyms.ts';

// Simulates D1's real reporting: each INSERT statement's meta.changes equals the
// number of value-tuples in its VALUES clause, the DELETE reports 0.
// NOTE: intentionally a plain function, not vi.fn — wrapping an existing vi.fn in
// another vi.fn() shares its call-history state across tests.
const fakeBatchAtomic = async (
  stmts: readonly { sql: string; params?: readonly unknown[] }[],
): Promise<D1Result[]> =>
  stmts.map((s) => {
    const rowCount = s.sql.startsWith('INSERT')
      ? (s.sql.match(/\([^()]*\?[^()]*\)/g)?.length ?? 0)
      : 0;
    return { success: true, meta: { changes: rowCount, last_row_id: null }, results: [] };
  });

describe('seedSynonyms', () => {
  test('deletes all synonyms then inserts merged dictionaries via a single atomic batch', async () => {
    const batchAtomic = vi.fn(fakeBatchAtomic);
    const execute = vi.fn(async () => ({
      success: true,
      meta: { changes: 0, last_row_id: null },
      results: [],
    }));
    const client = { execute, batchAtomic } as unknown as D1Client;
    const dict: SynonymDictionary = [
      { term: 'home', expansion: 'house', lang: 'en' },
      { term: 'カート', expansion: 'cart', lang: 'ja' },
    ];
    const result = await seedSynonyms({ d1: client, dictionaries: [dict] });
    expect(result.inserted).toBe(2);
    expect(batchAtomic).toHaveBeenCalledTimes(1);
    const statements = batchAtomic.mock.calls[0]?.[0] as ReadonlyArray<{ sql: string }>;
    expect(statements[0]?.sql).toBe('DELETE FROM synonyms');
    expect(statements[1]?.sql.startsWith('INSERT INTO synonyms')).toBe(true);
    expect(execute).not.toHaveBeenCalled();
  });

  test('uses default dictionaries when none provided (packages/synonyms)', async () => {
    const batchAtomic = vi.fn(fakeBatchAtomic);
    const client = { batchAtomic } as unknown as D1Client;
    const result = await seedSynonyms({ d1: client });
    expect(result.inserted).toBeGreaterThan(0);
  });

  test('batches inserts by batchSize within one statement array', async () => {
    const batchAtomic = vi.fn(fakeBatchAtomic);
    const client = { batchAtomic } as unknown as D1Client;
    const dict: SynonymDictionary = Array.from({ length: 250 }, (_, i) => ({
      term: `t${i}`,
      expansion: `e${i}`,
      lang: 'en' as const,
    }));
    await seedSynonyms({ d1: client, dictionaries: [dict], batchSize: 100 });
    const statements = batchAtomic.mock.calls[0]?.[0] as ReadonlyArray<{ sql: string }>;
    const inserts = statements.filter((s) => s.sql.startsWith('INSERT INTO synonyms'));
    // 250 / 100 = 3 insert batches (100 + 100 + 50), plus the leading DELETE = 4 statements
    expect(inserts.length).toBe(3);
    expect(statements.length).toBe(4);
  });

  test('default batchSize keeps bind params under 100 per statement', async () => {
    const batchAtomic = vi.fn(fakeBatchAtomic);
    const client = { batchAtomic } as unknown as D1Client;
    const dict: SynonymDictionary = Array.from({ length: 50 }, (_, i) => ({
      term: `t${i}`,
      expansion: `e${i}`,
      lang: 'en' as const,
    }));
    await seedSynonyms({ d1: client, dictionaries: [dict] });
    const statements = batchAtomic.mock.calls[0]?.[0] as ReadonlyArray<{
      sql: string;
      params: unknown[];
    }>;
    for (const s of statements) expect(s.params.length).toBeLessThanOrEqual(100);
  });
});
