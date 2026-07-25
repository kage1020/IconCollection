import { collectFromIconify } from './collect.ts';
import { D1Client } from './d1.ts';
import { detectChanges, readIconifyVersion } from './detect.ts';
import { R2Client } from './r2.ts';
import { applySchema } from './schema.ts';
import { rebuildFts } from './seed-fts.ts';
import { seedIcons } from './seed-icons.ts';
import { seedCollectionMeta } from './seed-meta.ts';
import { seedSynonyms } from './seed-synonyms.ts';
import { syncSnapshotsToR2 } from './sync-r2.ts';
import type { CollectionSnapshot, IngestConfig, IngestReport } from './types.ts';

export type RunDeps = {
  r2?: R2Client;
  d1?: D1Client;
  readVersion?: () => Promise<string>;
  collect?: (collection: string, version: string) => Promise<CollectionSnapshot>;
};

export const run = async (config: IngestConfig, deps: RunDeps = {}): Promise<IngestReport> => {
  const startedAt = new Date().toISOString();
  const r2 = deps.r2 ?? new R2Client(config.r2);
  const d1 = deps.d1 ?? new D1Client(config.d1);
  const readVersion = deps.readVersion ?? readIconifyVersion;
  const collect = deps.collect ?? collectFromIconify;

  await applySchema(d1);

  const currentVersion = await readVersion();
  const storedVersions = (await r2.getJson<Record<string, string>>('meta/version.json')) ?? {};
  const { changed, nextVersions } = detectChanges({
    collections: config.collections,
    currentVersion,
    storedVersions,
  });

  if (changed.length === 0) {
    return {
      collectionsChecked: config.collections.length,
      collectionsChanged: [],
      d1RowsInserted: 0,
      ftsRebuilt: false,
      startedAt,
      finishedAt: new Date().toISOString(),
    };
  }

  const snapshots: CollectionSnapshot[] = [];
  for (const collection of changed) {
    snapshots.push(await collect(collection, currentVersion));
  }

  await syncSnapshotsToR2({ r2, snapshots, dryRun: config.dryRun });
  await r2.putJson('meta/version.json', nextVersions);

  let d1RowsInserted = 0;
  let ftsRebuilt = false;
  if (!config.dryRun) {
    const iconsResult = await seedIcons({ d1, snapshots });
    d1RowsInserted += iconsResult.inserted;
    await seedSynonyms({ d1 });
    await seedCollectionMeta({ d1, snapshots });
    await rebuildFts(d1);
    ftsRebuilt = true;
  }

  return {
    collectionsChecked: config.collections.length,
    collectionsChanged: [...changed],
    d1RowsInserted,
    ftsRebuilt,
    startedAt,
    finishedAt: new Date().toISOString(),
  };
};
