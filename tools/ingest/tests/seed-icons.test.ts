import { describe, expect, test, vi } from 'vitest';
import type { D1Client } from '../src/d1.ts';
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

describe('seedIcons', () => {
  test('deletes then inserts icons for each collection', async () => {
    const execute = vi.fn(async (_sql: string, _params?: readonly unknown[]) => okResult);
    const client = { execute } as unknown as D1Client;
    const result = await seedIcons({ d1: client, snapshots: [snap()] });
    expect(result.deleted).toBe(1);
    expect(result.inserted).toBe(3);
    const sqlCalls = execute.mock.calls.map(([sql]) => sql as string);
    expect(sqlCalls.some((s) => s.startsWith('DELETE FROM icons'))).toBe(true);
    expect(sqlCalls.some((s) => s.startsWith('INSERT INTO icons'))).toBe(true);
  });

  test('splits large collections into batches of batchSize rows', async () => {
    const execute = vi.fn(async (_sql: string, _params?: readonly unknown[]) => okResult);
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
    const inserts = execute.mock.calls.filter(([sql]) =>
      (sql as string).startsWith('INSERT INTO icons'),
    );
    // 1200 / 500 = 3 batches
    expect(inserts.length).toBe(3);
  });

  test('encodes categories and aliases as CSV strings, or null when absent', async () => {
    const execute = vi.fn(async (_sql: string, _params?: readonly unknown[]) => okResult);
    const client = { execute } as unknown as D1Client;
    await seedIcons({ d1: client, snapshots: [snap()] });
    const inserts = execute.mock.calls
      .filter(([sql]) => (sql as string).startsWith('INSERT INTO icons'))
      .flatMap(([, params]) => params as unknown[]);
    // parameter layout per row: collection, name, license, categories, tags, aliases, updated_at
    const home = inserts.slice(0, 7);
    expect(home[0]).toBe('mdi');
    expect(home[1]).toBe('home');
    expect(home[3]).toBe('Navigation');
    expect(home[5]).toBe('house');
    const account = inserts.slice(7, 14);
    expect(account[3]).toBe('People');
    expect(account[5]).toBeNull();
  });

  test('default batchSize keeps bind params under 100 per query', async () => {
    const captured: number[] = [];
    const execute = vi.fn(async (_sql: string, params?: readonly unknown[]) => {
      if (params !== undefined) captured.push(params.length);
      return okResult;
    });
    const client = { execute } as unknown as D1Client;
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
    for (const size of captured) expect(size).toBeLessThanOrEqual(100);
  });
});
