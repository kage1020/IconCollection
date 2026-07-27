import type { SynonymDictionary } from '@icon-collection/synonyms';
import { describe, expect, test, vi } from 'vitest';
import type { D1Client } from '../src/d1.ts';
import { seedSynonyms } from '../src/seed-synonyms.ts';

const ok = { success: true, meta: { changes: 0, last_row_id: null }, results: [] };

describe('seedSynonyms', () => {
  test('deletes all synonyms then inserts merged dictionaries', async () => {
    const execute = vi.fn(async (_sql: string, _params?: readonly unknown[]) => ok);
    const client = { execute } as unknown as D1Client;
    const dict: SynonymDictionary = [
      { term: 'home', expansion: 'house', lang: 'en' },
      { term: 'カート', expansion: 'cart', lang: 'ja' },
    ];
    const result = await seedSynonyms({ d1: client, dictionaries: [dict] });
    expect(result.inserted).toBe(2);
    const sqlCalls = execute.mock.calls.map(([sql]) => sql as string);
    expect(sqlCalls[0]).toBe('DELETE FROM synonyms');
    expect(sqlCalls[1]?.startsWith('INSERT INTO synonyms')).toBe(true);
  });

  test('uses default dictionaries when none provided (packages/synonyms)', async () => {
    const execute = vi.fn(async (_sql: string, _params?: readonly unknown[]) => ok);
    const client = { execute } as unknown as D1Client;
    const result = await seedSynonyms({ d1: client });
    expect(result.inserted).toBeGreaterThan(0);
  });

  test('batches inserts by batchSize', async () => {
    const execute = vi.fn(async (_sql: string, _params?: readonly unknown[]) => ok);
    const client = { execute } as unknown as D1Client;
    const dict: SynonymDictionary = Array.from({ length: 250 }, (_, i) => ({
      term: `t${i}`,
      expansion: `e${i}`,
      lang: 'en' as const,
    }));
    await seedSynonyms({ d1: client, dictionaries: [dict], batchSize: 100 });
    const inserts = execute.mock.calls.filter(([sql]) =>
      (sql as string).startsWith('INSERT INTO synonyms'),
    );
    // 250 / 100 = 3 batches (100 + 100 + 50)
    expect(inserts.length).toBe(3);
  });

  test('default batchSize keeps bind params under 100 per query', async () => {
    const captured: number[] = [];
    const execute = vi.fn(async (_sql: string, params?: readonly unknown[]) => {
      if (params !== undefined) captured.push(params.length);
      return ok;
    });
    const client = { execute } as unknown as D1Client;
    const dict: SynonymDictionary = Array.from({ length: 50 }, (_, i) => ({
      term: `t${i}`,
      expansion: `e${i}`,
      lang: 'en' as const,
    }));
    await seedSynonyms({ d1: client, dictionaries: [dict] });
    for (const size of captured) expect(size).toBeLessThanOrEqual(100);
  });
});
