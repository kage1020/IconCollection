import type { R2Client } from './r2.ts';
import type { CollectionSnapshot } from './types.ts';

export type SyncInput = {
  r2: R2Client;
  snapshots: readonly CollectionSnapshot[];
  dryRun?: boolean;
};

export type SyncResult = {
  uploaded: string[];
  unchanged: string[];
};

export const syncSnapshotsToR2 = async (input: SyncInput): Promise<SyncResult> => {
  const uploaded: string[] = [];
  const unchanged: string[] = [];
  if (input.dryRun) {
    for (const snap of input.snapshots) unchanged.push(snap.collection);
    return { uploaded, unchanged };
  }
  for (const snap of input.snapshots) {
    const result = await input.r2.putJson(`iconify/${snap.collection}.json`, snap.body);
    if (result.changed) uploaded.push(snap.collection);
    else unchanged.push(snap.collection);
  }
  const versions: Record<string, string> = {};
  for (const snap of input.snapshots) versions[snap.collection] = snap.version;
  await input.r2.putJson('meta/version.json', versions);
  return { uploaded, unchanged };
};
