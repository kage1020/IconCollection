import type { D1Client } from './d1.ts';

export const rebuildFts = async (d1: D1Client): Promise<void> => {
  await d1.execute("INSERT INTO icons_fts(icons_fts) VALUES('rebuild')");
};
