import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import type { IconifyJSON } from '@iconify/types';
import { describe, expect, test } from 'vitest';
import { collectFromIconify, collectFromPath } from '../src/collect.ts';

const fixture = (name: string): string =>
  fileURLToPath(new URL(`../__fixtures__/${name}`, import.meta.url));

const require = createRequire(import.meta.url);

const loadFromIconifyPackage = async (collection: string): Promise<IconifyJSON> => {
  const jsonPath = require.resolve(`@iconify/json/json/${collection}.json`);
  const raw = await readFile(jsonPath, 'utf-8');
  return JSON.parse(raw) as IconifyJSON;
};

describe('collectFromPath', () => {
  test('reads mdi fixture and returns CollectionSnapshot with 3 icons', async () => {
    const snap = await collectFromPath(fixture('mdi-mini.json'), '2.2.400');
    expect(snap.collection).toBe('mdi');
    expect(snap.version).toBe('2.2.400');
    expect(snap.license).toBe('Apache-2.0');
    expect(snap.total).toBe(3);
    expect(snap.body.prefix).toBe('mdi');
    expect(Object.keys(snap.body.icons)).toEqual(['home', 'account', 'search']);
  });

  test('reads lucide fixture and returns 2 icons with ISC license', async () => {
    const snap = await collectFromPath(fixture('lucide-mini.json'), '2.2.400');
    expect(snap.total).toBe(2);
    expect(snap.license).toBe('ISC');
  });
});

describe('collectFromIconify', () => {
  test('reads mdi from installed @iconify/json and returns a large snapshot', async () => {
    const snap = await collectFromIconify({ collection: 'mdi', load: loadFromIconifyPackage });
    expect(snap.collection).toBe('mdi');
    expect(snap.total).toBeGreaterThan(100);
    expect(snap.license.length).toBeGreaterThan(0);
    expect(snap.body.prefix).toBe('mdi');
  });

  test('throws when the collection is not present in @iconify/json', async () => {
    await expect(
      collectFromIconify({ collection: 'this-does-not-exist', load: loadFromIconifyPackage }),
    ).rejects.toThrow();
  });

  test('extracts default width/height from Iconify JSON, falling back to 24', async () => {
    const cases = [
      { body: { prefix: 'a', info: {}, icons: {}, width: 32, height: 32 }, expected: [32, 32] },
      { body: { prefix: 'b', info: {}, icons: {} }, expected: [24, 24] },
    ] as const;
    for (const c of cases) {
      const input = { collection: c.body.prefix, load: async () => c.body as never };
      const snap = await collectFromIconify(input);
      expect([snap.defaultWidth, snap.defaultHeight]).toEqual(c.expected);
    }
  });
});
