import { describe, expect, test, vi } from 'vitest';
import type { R2Client } from '../src/r2.ts';
import { syncSnapshotsToR2 } from '../src/sync-r2.ts';
import type { CollectionSnapshot } from '../src/types.ts';

const makeSnap = (collection: string): CollectionSnapshot => ({
  collection,
  version: '2.2.400',
  license: 'MIT',
  total: 3,
  defaultWidth: 24,
  defaultHeight: 24,
  body: {
    prefix: collection,
    icons: { home: { body: '<path/>' } },
  } as CollectionSnapshot['body'],
});

const stubClient = (impl: {
  putJson: R2Client['putJson'];
  getJson: R2Client['getJson'];
  putIfChanged?: R2Client['putIfChanged'];
}): R2Client => impl as unknown as R2Client;

describe('syncSnapshotsToR2', () => {
  test('uploads each collection JSON and reports unchanged when digests match', async () => {
    const digests: Record<string, string> = {};
    const putJson = vi.fn(async (key: string, value: unknown) => {
      const digest = JSON.stringify(value);
      if (digests[key] === digest) return { changed: false, sha256: digest };
      digests[key] = digest;
      return { changed: true, sha256: digest };
    });
    const client = stubClient({ putJson, getJson: async () => null });
    const snaps = [makeSnap('mdi'), makeSnap('lucide')];
    const first = await syncSnapshotsToR2({ r2: client, snapshots: snaps });
    expect(first.uploaded.sort()).toEqual(['lucide', 'mdi']);
    expect(first.unchanged).toEqual([]);
    const second = await syncSnapshotsToR2({ r2: client, snapshots: snaps });
    expect(second.uploaded).toEqual([]);
    expect(second.unchanged.sort()).toEqual(['lucide', 'mdi']);
  });

  test('dryRun avoids putJson entirely', async () => {
    const putJson = vi.fn(async () => ({ changed: true, sha256: 'x' }));
    const client = stubClient({ putJson, getJson: async () => null });
    const result = await syncSnapshotsToR2({
      r2: client,
      snapshots: [makeSnap('mdi')],
      dryRun: true,
    });
    expect(putJson).not.toHaveBeenCalled();
    expect(result.uploaded).toEqual([]);
    expect(result.unchanged).toEqual(['mdi']);
  });
});
