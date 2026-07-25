import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import type { CollectionSnapshot, IconifyJSON } from './types.ts';

type IconifyLicense = {
  title?: string;
  spdx?: string;
};

const extractLicense = (body: IconifyJSON): string => {
  const info = body.info as { license?: IconifyLicense } | undefined;
  return info?.license?.title ?? info?.license?.spdx ?? 'unknown';
};

const parseSnapshot = (raw: string, version: string): CollectionSnapshot => {
  const body = JSON.parse(raw) as IconifyJSON;
  return {
    collection: body.prefix,
    version,
    license: extractLicense(body),
    total: Object.keys(body.icons).length,
    body,
  };
};

export const collectFromPath = async (
  path: string,
  version: string,
): Promise<CollectionSnapshot> => {
  const raw = await readFile(path, 'utf-8');
  return parseSnapshot(raw, version);
};

export const collectFromIconify = async (
  collection: string,
  version: string,
): Promise<CollectionSnapshot> => {
  const require = createRequire(import.meta.url);
  const jsonPath = require.resolve(`@iconify/json/json/${collection}.json`);
  return collectFromPath(jsonPath, version);
};
