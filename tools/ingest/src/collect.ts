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

type CollectFromIconifyInput = {
  collection: string;
  load: (collection: string) => Promise<IconifyJSON>;
};

export async function collectFromIconify(
  input: CollectFromIconifyInput,
): Promise<CollectionSnapshot>;
export async function collectFromIconify(
  collection: string,
  version: string,
): Promise<CollectionSnapshot>;
export async function collectFromIconify(
  collectionOrInput: string | CollectFromIconifyInput,
  version?: string,
): Promise<CollectionSnapshot> {
  if (typeof collectionOrInput === 'string') {
    // Old signature: (collection: string, version: string)
    const collection = collectionOrInput;
    if (typeof version !== 'string') {
      throw new Error('Version is required when passing collection as a string');
    }
    const require = createRequire(import.meta.url);
    const jsonPath = require.resolve(`@iconify/json/json/${collection}.json`);
    return collectFromPath(jsonPath, version);
  }
  // New signature: ({ collection, load })
  const input = collectionOrInput;
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
}
