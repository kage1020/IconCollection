import { describe, expect, test, vi } from 'vitest';
import type { D1Client } from '../src/d1.ts';
import { seedCollectionMeta } from '../src/seed-meta.ts';
import type { CollectionSnapshot } from '../src/types.ts';

const ok = { success: true, meta: { changes: 1, last_row_id: null }, results: [] };

const snap = (collection: string): CollectionSnapshot => ({
  collection,
  version: '2.2.400',
  license: 'MIT',
  total: 10,
  defaultWidth: 24,
  defaultHeight: 24,
  body: { prefix: collection, icons: {} } as CollectionSnapshot['body'],
});

describe('seedCollectionMeta', () => {
  test('upserts one row per snapshot via ON CONFLICT clause', async () => {
    const execute = vi.fn(async (_sql: string, _params?: readonly unknown[]) => ok);
    const client = { execute } as unknown as D1Client;
    const result = await seedCollectionMeta({
      d1: client,
      snapshots: [snap('mdi'), snap('lucide')],
    });
    expect(result.upserted).toBe(2);
    const sql = execute.mock.calls[0]?.[0] as string;
    expect(sql).toMatch(/INSERT INTO collection_meta/);
    expect(sql).toMatch(/ON CONFLICT\(collection\) DO UPDATE/);
  });

  test('passes collection, version, license, total, and synced_at as params', async () => {
    const execute = vi.fn(async (_sql: string, _params?: readonly unknown[]) => ok);
    const client = { execute } as unknown as D1Client;
    await seedCollectionMeta({ d1: client, snapshots: [snap('mdi')] });
    const params = execute.mock.calls[0]?.[1] as unknown[];
    expect(params[0]).toBe('mdi');
    expect(params[1]).toBe('2.2.400');
    expect(params[2]).toBe('MIT');
    expect(params[3]).toBe(10);
    expect(typeof params[4]).toBe('number');
  });

  test('writes default_width and default_height', async () => {
    const execute = vi.fn(async () => ({
      success: true,
      meta: { changes: 1, last_row_id: null },
      results: [],
    }));
    const d1 = { execute } as unknown as D1Client;
    const makeSnap = (over: Partial<CollectionSnapshot> = {}): CollectionSnapshot => ({
      collection: 'mdi',
      version: '1.0.0',
      license: 'Apache-2.0',
      total: 10,
      defaultWidth: 24,
      defaultHeight: 24,
      body: { prefix: 'mdi', icons: {}, info: {} as never },
      ...over,
    });
    await seedCollectionMeta({
      d1,
      snapshots: [makeSnap({ defaultWidth: 32, defaultHeight: 32 })],
    });
    const calls = execute.mock.calls as unknown as Array<[string, readonly unknown[]]>;
    expect(calls[0]?.[1]).toEqual(['mdi', '1.0.0', 'Apache-2.0', 10, 32, 32, expect.any(Number)]);
  });
});
