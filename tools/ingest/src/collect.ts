import { readFile } from 'node:fs/promises';
import type { CollectionSnapshot, IconifyJSON } from './types.ts';

type IconifyLicense = {
  title?: string;
  spdx?: string;
};

const extractLicense = (body: IconifyJSON): string => {
  const info = body.info as { license?: IconifyLicense } | undefined;
  return info?.license?.title ?? info?.license?.spdx ?? 'unknown';
};

const extractDefaultDimensions = (body: IconifyJSON): [number, number] => {
  const width = typeof body.width === 'number' && body.width > 0 ? body.width : 24;
  const height = typeof body.height === 'number' && body.height > 0 ? body.height : 24;
  return [width, height];
};

const parseSnapshot = (raw: string, version: string): CollectionSnapshot => {
  const body = JSON.parse(raw) as IconifyJSON;
  const [defaultWidth, defaultHeight] = extractDefaultDimensions(body);
  return {
    collection: body.prefix,
    version,
    license: extractLicense(body),
    total: Object.keys(body.icons).length,
    defaultWidth,
    defaultHeight,
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

export type CollectFromIconifyInput = {
  collection: string;
  load: (collection: string) => Promise<IconifyJSON>;
};

export const collectFromIconify = async (
  input: CollectFromIconifyInput,
): Promise<CollectionSnapshot> => {
  const body = await input.load(input.collection);
  const [defaultWidth, defaultHeight] = extractDefaultDimensions(body);
  return {
    collection: input.collection,
    version: (body.info as { version?: string } | undefined)?.version ?? '0.0.0',
    license: extractLicense(body),
    total: Object.keys(body.icons ?? {}).length,
    defaultWidth,
    defaultHeight,
    body,
  };
};
