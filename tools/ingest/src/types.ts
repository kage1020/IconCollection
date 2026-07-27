import type { IconifyJSON } from '@iconify/types';

export type { IconifyJSON };

export type CollectionSnapshot = {
  collection: string;
  version: string;
  license: string;
  total: number;
  defaultWidth: number;
  defaultHeight: number;
  body: IconifyJSON;
};

export type IngestReport = {
  collectionsChecked: number;
  collectionsChanged: string[];
  d1RowsInserted: number;
  ftsRebuilt: boolean;
  startedAt: string;
  finishedAt: string;
};

export type IngestConfig = {
  r2: {
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
  };
  d1: {
    apiToken: string;
    accountId: string;
    databaseId: string;
  };
  collections: readonly string[];
  dryRun: boolean;
};
