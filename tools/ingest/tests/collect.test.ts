import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { collectFromIconify, collectFromPath } from '../src/collect.ts';

const fixture = (name: string): string =>
  fileURLToPath(new URL(`../__fixtures__/${name}`, import.meta.url));

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
    const snap = await collectFromIconify('mdi', '2.2.400');
    expect(snap.collection).toBe('mdi');
    expect(snap.version).toBe('2.2.400');
    expect(snap.total).toBeGreaterThan(100);
    expect(snap.license.length).toBeGreaterThan(0);
    expect(snap.body.prefix).toBe('mdi');
  });

  test('throws when the collection is not present in @iconify/json', async () => {
    await expect(collectFromIconify('this-does-not-exist', '2.2.400')).rejects.toThrow();
  });
});
