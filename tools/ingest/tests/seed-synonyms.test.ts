import type { SynonymDictionary } from '@icon-collection/synonyms';
import { describe, expect, test, vi } from 'vitest';
import type { D1Client, D1Result } from '../src/d1.ts';
import { seedSynonyms } from '../src/seed-synonyms.ts';

const okResult: D1Result = { success: true, meta: { changes: 0, last_row_id: null }, results: [] };

const rowCountFromInsert = (sql: string): number => (sql.match(/\(/g)?.length ?? 0) - 1;

const makeExecute = () =>
  vi.fn(async (sql: string): Promise<D1Result> => {
    if (/^\s*INSERT\b/i.test(sql)) {
      return { ...okResult, meta: { changes: rowCountFromInsert(sql), last_row_id: null } };
    }
    return okResult;
  });

describe('seedSynonyms', () => {
  test('DELETEs all synonyms then INSERTs merged dictionaries via serial execute', async () => {
    const execute = makeExecute();
    const client = { execute } as unknown as D1Client;
    const dict: SynonymDictionary = [
      { term: 'home', expansion: 'house', lang: 'en' },
      { term: 'カート', expansion: 'cart', lang: 'ja' },
    ];
    const result = await seedSynonyms({ d1: client, dictionaries: [dict] });
    expect(result.inserted).toBe(2);
    const calls = execute.mock.calls.map((c) => c[0] as string);
    expect(calls[0]).toBe('DELETE FROM synonyms');
    expect(calls[1]).toMatch(/^INSERT INTO synonyms/);
  });

  test('inlines term / expansion / lang / weight as SQL literals', async () => {
    const execute = makeExecute();
    const client = { execute } as unknown as D1Client;
    const dict: SynonymDictionary = [{ term: 'home', expansion: 'house', lang: 'en', weight: 0.8 }];
    await seedSynonyms({ d1: client, dictionaries: [dict] });
    const insertSql =
      execute.mock.calls.map((c) => c[0] as string).find((s) => /^INSERT INTO synonyms/.test(s)) ??
      '';
    expect(insertSql).toContain("('home', 'house', 'en', 0.8)");
  });

  test('defaults weight to 1 when not specified', async () => {
    const execute = makeExecute();
    const client = { execute } as unknown as D1Client;
    const dict: SynonymDictionary = [{ term: 'a', expansion: 'b', lang: 'en' }];
    await seedSynonyms({ d1: client, dictionaries: [dict] });
    const insertSql =
      execute.mock.calls.map((c) => c[0] as string).find((s) => /^INSERT INTO synonyms/.test(s)) ??
      '';
    expect(insertSql).toContain("('a', 'b', 'en', 1)");
  });

  test('uses default dictionaries when none provided (packages/synonyms)', async () => {
    const execute = makeExecute();
    const client = { execute } as unknown as D1Client;
    const result = await seedSynonyms({ d1: client });
    expect(result.inserted).toBeGreaterThan(0);
  });

  test('splits large dictionaries into batches of batchSize rows per INSERT', async () => {
    const execute = makeExecute();
    const client = { execute } as unknown as D1Client;
    const dict: SynonymDictionary = Array.from({ length: 250 }, (_, i) => ({
      term: `t${i}`,
      expansion: `e${i}`,
      lang: 'en' as const,
    }));
    await seedSynonyms({ d1: client, dictionaries: [dict], batchSize: 100 });
    const inserts = execute.mock.calls
      .map((c) => c[0] as string)
      .filter((s) => /^INSERT INTO synonyms/.test(s));
    expect(inserts).toHaveLength(3);
    expect(rowCountFromInsert(inserts[0] ?? '')).toBe(100);
    expect(rowCountFromInsert(inserts[1] ?? '')).toBe(100);
    expect(rowCountFromInsert(inserts[2] ?? '')).toBe(50);
  });

  test('skips INSERT phase when no entries', async () => {
    const execute = makeExecute();
    const client = { execute } as unknown as D1Client;
    const result = await seedSynonyms({ d1: client, dictionaries: [] });
    expect(result.inserted).toBe(0);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0]?.[0]).toBe('DELETE FROM synonyms');
  });
});
