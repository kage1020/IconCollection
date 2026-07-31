import { fileURLToPath } from 'node:url';
import { describe, expect, test, vi } from 'vitest';
import { collectFromPath } from '../src/collect.ts';
import type { D1Client } from '../src/d1.ts';
import type { R2Client } from '../src/r2.ts';
import { run } from '../src/run.ts';
import type { IngestConfig } from '../src/types.ts';
import { makeFakeBatchAtomic } from './_helpers.ts';

const fixturePath = (name: string): string =>
  fileURLToPath(new URL(`../__fixtures__/${name}`, import.meta.url));

const baseConfig: IngestConfig = {
  r2: { accountId: 'acct', accessKeyId: 'k', secretAccessKey: 's', bucket: 'b' },
  d1: { apiToken: 't', accountId: 'acct', databaseId: 'db' },
  collections: ['mdi', 'lucide'],
  dryRun: false,
};

const okResult = { success: true, meta: { changes: 0, last_row_id: null }, results: [] };

const fakeBatchAtomic = makeFakeBatchAtomic();

describe('run', () => {
  test('performs detect -> collect -> sync-r2 -> seed-d1 and returns a report', async () => {
    const r2 = {
      putJson: vi.fn(async () => ({ changed: true, sha256: 'x' })),
      getJson: vi.fn(async () => null),
    } as unknown as R2Client;
    const d1 = {
      execute: vi.fn(async () => okResult),
      batchAtomic: vi.fn(fakeBatchAtomic),
    } as unknown as D1Client;
    const report = await run(baseConfig, {
      r2,
      d1,
      readVersion: async () => '2.2.500',
      collect: async (collection, version) =>
        collectFromPath(fixturePath(`${collection}-mini.json`), version),
    });
    expect(report.collectionsChecked).toBe(2);
    expect(report.collectionsChanged.sort()).toEqual(['lucide', 'mdi']);
    expect(report.d1RowsInserted).toBe(5); // 3 mdi + 2 lucide
    expect(report.ftsRebuilt).toBe(true);
    expect(report.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(report.finishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test('when storedVersions matches current, skips collect/sync and returns empty change list', async () => {
    const r2 = {
      putJson: vi.fn(async () => ({ changed: true, sha256: 'x' })),
      getJson: vi.fn(async (key: string) =>
        key === 'meta/version.json' ? { mdi: '2.2.500', lucide: '2.2.500' } : null,
      ),
    } as unknown as R2Client;
    const d1 = {
      execute: vi.fn(async () => okResult),
      batchAtomic: vi.fn(fakeBatchAtomic),
    } as unknown as D1Client;
    const collectSpy = vi.fn();
    const report = await run(baseConfig, {
      r2,
      d1,
      readVersion: async () => '2.2.500',
      collect: async (c, v) => {
        collectSpy(c, v);
        return collectFromPath(fixturePath(`${c}-mini.json`), v);
      },
    });
    expect(report.collectionsChanged).toEqual([]);
    expect(collectSpy).not.toHaveBeenCalled();
    expect(report.ftsRebuilt).toBe(false);
  });

  test('dryRun does not call D1 execute for inserts', async () => {
    const executed: string[] = [];
    const d1 = {
      execute: vi.fn(async (sql: string) => {
        executed.push(sql);
        return okResult;
      }),
    } as unknown as D1Client;
    const r2 = {
      putJson: vi.fn(async () => ({ changed: true, sha256: 'x' })),
      getJson: vi.fn(async () => null),
    } as unknown as R2Client;
    await run(
      { ...baseConfig, dryRun: true },
      {
        r2,
        d1,
        readVersion: async () => '2.2.500',
        collect: async (c, v) => collectFromPath(fixturePath(`${c}-mini.json`), v),
      },
    );
    // schema apply may still run, but no INSERT INTO icons
    expect(executed.some((s) => s.startsWith('INSERT INTO icons '))).toBe(false);
    expect(executed.some((s) => s.startsWith('DELETE FROM icons'))).toBe(false);
  });

  test('does not update meta/version.json when D1 seed throws', async () => {
    const r2Puts: Array<[string, unknown]> = [];
    const r2 = {
      putJson: vi.fn(async (key: string, value: unknown) => {
        r2Puts.push([key, value]);
        return { changed: true, sha256: 'x' };
      }),
      getJson: vi.fn(async () => null),
    } as unknown as R2Client;
    const d1 = {
      execute: vi.fn(async () => okResult),
      batchAtomic: vi.fn(async (stmts: readonly { sql: string }[]) => {
        if (stmts.some((s) => s.sql.startsWith('INSERT INTO icons '))) {
          throw new Error('boom');
        }
        return stmts.map(() => okResult);
      }),
    } as unknown as D1Client;
    await expect(
      run(baseConfig, {
        r2,
        d1,
        readVersion: async () => '2.2.500',
        collect: async (c, v) => collectFromPath(fixturePath(`${c}-mini.json`), v),
      }),
    ).rejects.toThrow('boom');
    expect(r2Puts.find(([k]) => k === 'meta/version.json')).toBeUndefined();
  });

  test('writes meta/version.json after all D1 seeding completes', async () => {
    const events: string[] = [];
    const r2 = {
      putJson: vi.fn(async (key: string) => {
        events.push(`put:${key}`);
        return { changed: true, sha256: 'x' };
      }),
      getJson: vi.fn(async () => null),
    } as unknown as R2Client;
    const d1 = {
      execute: vi.fn(async (sql: string) => {
        if (sql.startsWith("INSERT INTO icons_fts(icons_fts) VALUES('rebuild')")) {
          events.push('fts:rebuild');
        }
        return okResult;
      }),
      batchAtomic: vi.fn(fakeBatchAtomic),
    } as unknown as D1Client;
    await run(baseConfig, {
      r2,
      d1,
      readVersion: async () => '2.2.500',
      collect: async (c, v) => collectFromPath(fixturePath(`${c}-mini.json`), v),
    });
    const ftsIdx = events.indexOf('fts:rebuild');
    const metaIdx = events.indexOf('put:meta/version.json');
    expect(ftsIdx).toBeGreaterThanOrEqual(0);
    expect(metaIdx).toBeGreaterThan(ftsIdx);
  });
});
