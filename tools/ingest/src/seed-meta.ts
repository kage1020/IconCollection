import type { D1Client } from './d1.ts';
import type { CollectionSnapshot } from './types.ts';

export type SeedMetaInput = {
  d1: D1Client;
  snapshots: readonly CollectionSnapshot[];
};

export const seedCollectionMeta = async (input: SeedMetaInput): Promise<{ upserted: number }> => {
  const sql = `INSERT INTO collection_meta (collection, version, license, total, default_width, default_height, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(collection) DO UPDATE SET version = excluded.version, license = excluded.license, total = excluded.total, default_width = excluded.default_width, default_height = excluded.default_height, synced_at = excluded.synced_at`;
  const now = Math.floor(Date.now() / 1000);
  let upserted = 0;
  for (const snap of input.snapshots) {
    await input.d1.execute(sql, [
      snap.collection,
      snap.version,
      snap.license,
      snap.total,
      snap.defaultWidth,
      snap.defaultHeight,
      now,
    ]);
    upserted++;
  }
  return { upserted };
};
