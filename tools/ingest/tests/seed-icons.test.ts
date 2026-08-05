import { describe, expect, test, vi } from 'vitest';
import type { D1Client, D1Result } from '../src/d1.ts';
import { seedIcons } from '../src/seed-icons.ts';
import type { CollectionSnapshot } from '../src/types.ts';

const snap = (): CollectionSnapshot => ({
  collection: 'mdi',
  version: '2.2.400',
  license: 'Apache-2.0',
  total: 3,
  defaultWidth: 24,
  defaultHeight: 24,
  body: {
    prefix: 'mdi',
    icons: {
      home: { body: '<path/>' },
      account: { body: '<path/>' },
      search: { body: '<path/>' },
    },
    aliases: {
      house: { parent: 'home' },
    },
    categories: {
      Navigation: ['home'],
      People: ['account'],
    },
  } as CollectionSnapshot['body'],
});

const okResult: D1Result = { success: true, meta: { changes: 0, last_row_id: null }, results: [] };

const rowCountFromInsert = (sql: string): number => (sql.match(/\(/g)?.length ?? 0) - 1;

const makeExecute = () =>
  vi.fn(async (sql: string): Promise<D1Result> => {
    if (/^\s*INSERT\b/i.test(sql)) {
      return { ...okResult, meta: { changes: rowCountFromInsert(sql), last_row_id: null } };
    }
    return okResult;
  });

describe('seedIcons', () => {
  test('DELETEs then INSERTs icons for each collection via serial execute calls', async () => {
    const execute = makeExecute();
    const client = { execute } as unknown as D1Client;
    const result = await seedIcons({ d1: client, snapshots: [snap()] });
    expect(result.deleted).toBe(1);
    expect(result.inserted).toBe(3);
    const calls = execute.mock.calls.map((c) => c[0] as string);
    expect(calls[0]).toMatch(/^DELETE FROM icons WHERE collection = 'mdi'/);
    expect(calls.slice(1).every((s) => /^INSERT INTO icons/.test(s))).toBe(true);
  });

  test('inlines collection name as SQL literal in DELETE, escaping single quotes', async () => {
    const execute = makeExecute();
    const client = { execute } as unknown as D1Client;
    const dangerous: CollectionSnapshot = {
      ...snap(),
      collection: "mdi's",
      body: { prefix: 'x', icons: {} } as CollectionSnapshot['body'],
    };
    await seedIcons({ d1: client, snapshots: [dangerous] });
    const firstSql = execute.mock.calls[0]?.[0];
    expect(firstSql).toBe("DELETE FROM icons WHERE collection = 'mdi''s'");
  });

  test('splits large collections into batches of batchSize rows per INSERT', async () => {
    const execute = makeExecute();
    const client = { execute } as unknown as D1Client;
    const icons: Record<string, { body: string }> = {};
    for (let i = 0; i < 1200; i++) icons[`i${i}`] = { body: '<path/>' };
    const big: CollectionSnapshot = {
      collection: 'big',
      version: '1',
      license: 'MIT',
      total: 1200,
      defaultWidth: 24,
      defaultHeight: 24,
      body: { prefix: 'big', icons } as CollectionSnapshot['body'],
    };
    await seedIcons({ d1: client, snapshots: [big], batchSize: 500 });
    const insertCalls = execute.mock.calls
      .map((c) => c[0] as string)
      .filter((s) => /^INSERT INTO icons/.test(s));
    // 1200 rows / 500 per batch = 3 INSERT statements
    expect(insertCalls).toHaveLength(3);
    expect(rowCountFromInsert(insertCalls[0] ?? '')).toBe(500);
    expect(rowCountFromInsert(insertCalls[1] ?? '')).toBe(500);
    expect(rowCountFromInsert(insertCalls[2] ?? '')).toBe(200);
  });

  test('encodes categories and aliases as CSV strings, NULL when absent', async () => {
    const execute = makeExecute();
    const client = { execute } as unknown as D1Client;
    await seedIcons({ d1: client, snapshots: [snap()] });
    const insertSql =
      execute.mock.calls.map((c) => c[0] as string).find((s) => /^INSERT INTO icons/.test(s)) ?? '';
    // home row carries the alias 'house' and category 'Navigation'
    expect(insertSql).toContain("'mdi', 'home', 'Apache-2.0', 'Navigation', NULL, 'house'");
    // account row: category 'People', no aliases
    expect(insertSql).toContain("'mdi', 'account', 'Apache-2.0', 'People', NULL, NULL");
    // search row: no category, no alias
    expect(insertSql).toContain("'mdi', 'search', 'Apache-2.0', NULL, NULL, NULL");
  });

  test('skips INSERT phase when a collection has zero icons', async () => {
    const execute = makeExecute();
    const client = { execute } as unknown as D1Client;
    const empty: CollectionSnapshot = {
      ...snap(),
      body: { prefix: 'mdi', icons: {} } as CollectionSnapshot['body'],
    };
    const result = await seedIcons({ d1: client, snapshots: [empty] });
    expect(result.deleted).toBe(1);
    expect(result.inserted).toBe(0);
    expect(execute).toHaveBeenCalledTimes(1);
    const firstSql = (execute.mock.calls[0]?.[0] as string) ?? '';
    expect(firstSql.startsWith('DELETE FROM icons')).toBe(true);
  });
});
