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

const okResult = { success: true, meta: { changes: 0, last_row_id: null }, results: [] };

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

describe('seedIcons', () => {
  test('deletes then inserts icons for each collection via a single atomic batch', async () => {
    const batchAtomic = vi.fn(fakeBatchAtomic);
    const execute = vi.fn(async () => okResult);
    const client = { execute, batchAtomic } as unknown as D1Client;
    const result = await seedIcons({ d1: client, snapshots: [snap()] });
    expect(result.deleted).toBe(1);
    expect(result.inserted).toBe(3);
    expect(batchAtomic).toHaveBeenCalledTimes(1);
    const statements = batchAtomic.mock.calls[0]?.[0] as ReadonlyArray<{ sql: string }>;
    expect(statements[0]?.sql.startsWith('DELETE FROM icons')).toBe(true);
    expect(statements.some((s) => s.sql.startsWith('INSERT INTO icons'))).toBe(true);
    expect(execute).not.toHaveBeenCalled();
  });

  test('uses batchAtomic to combine DELETE and INSERT per collection', async () => {
    const batchAtomic = vi.fn(async (stmts: unknown[]) =>
      stmts.map(() => ({ success: true, meta: { changes: 1, last_row_id: null }, results: [] })),
    );
    const execute = vi.fn(async () => ({
      success: true,
      meta: { changes: 0, last_row_id: null },
      results: [],
    }));
    const d1 = { execute, batchAtomic } as unknown as D1Client;
    await seedIcons({ d1, snapshots: [snap()] });
    expect(batchAtomic).toHaveBeenCalled();
    const firstBatch = batchAtomic.mock.calls[0]?.[0] as ReadonlyArray<{ sql: string }>;
    expect(firstBatch[0]?.sql).toContain('DELETE FROM icons');
  });

  test('splits large collections into batches of batchSize rows within one statement array', async () => {
    const batchAtomic = vi.fn(fakeBatchAtomic);
    const client = { batchAtomic } as unknown as D1Client;
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
    const statements = batchAtomic.mock.calls[0]?.[0] as ReadonlyArray<{ sql: string }>;
    const inserts = statements.filter((s) => s.sql.startsWith('INSERT INTO icons'));
    // 1200 / 500 = 3 insert batches, plus the leading DELETE = 4 statements total
    expect(inserts.length).toBe(3);
    expect(statements.length).toBe(4);
  });

  test('encodes categories and aliases as CSV strings, or null when absent', async () => {
    const batchAtomic = vi.fn(fakeBatchAtomic);
    const client = { batchAtomic } as unknown as D1Client;
    await seedIcons({ d1: client, snapshots: [snap()] });
    const statements = batchAtomic.mock.calls[0]?.[0] as ReadonlyArray<{
      sql: string;
      params: unknown[];
    }>;
    const insertParams = statements
      .filter((s) => s.sql.startsWith('INSERT INTO icons'))
      .flatMap((s) => s.params);
    // parameter layout per row: collection, name, license, categories, tags, aliases, updated_at
    const home = insertParams.slice(0, 7);
    expect(home[0]).toBe('mdi');
    expect(home[1]).toBe('home');
    expect(home[3]).toBe('Navigation');
    expect(home[5]).toBe('house');
    const account = insertParams.slice(7, 14);
    expect(account[3]).toBe('People');
    expect(account[5]).toBeNull();
  });

  test('default batchSize keeps bind params under 100 per statement', async () => {
    const batchAtomic = vi.fn(fakeBatchAtomic);
    const client = { batchAtomic } as unknown as D1Client;
    const icons: Record<string, { body: string }> = {};
    for (let i = 0; i < 50; i++) icons[`i${i}`] = { body: '<path/>' };
    const snap: CollectionSnapshot = {
      collection: 'test',
      version: '1',
      license: 'MIT',
      total: 50,
      defaultWidth: 24,
      defaultHeight: 24,
      body: { prefix: 'test', icons } as CollectionSnapshot['body'],
    };
    await seedIcons({ d1: client, snapshots: [snap] });
    const statements = batchAtomic.mock.calls[0]?.[0] as ReadonlyArray<{
      sql: string;
      params: unknown[];
    }>;
    for (const s of statements) expect(s.params.length).toBeLessThanOrEqual(100);
  });
});
