import { describe, expect, test } from 'vitest';
import { detectChanges, readIconifyVersion } from '../src/detect.ts';

describe('detectChanges', () => {
  test('flags all collections as changed when storedVersions is empty', () => {
    const result = detectChanges({
      collections: ['mdi', 'lucide'],
      currentVersion: '2.2.400',
      storedVersions: {},
    });
    expect(result.changed).toEqual(['mdi', 'lucide']);
    expect(result.nextVersions).toEqual({ mdi: '2.2.400', lucide: '2.2.400' });
  });

  test('flags nothing when all stored versions match current', () => {
    const result = detectChanges({
      collections: ['mdi'],
      currentVersion: '2.2.400',
      storedVersions: { mdi: '2.2.400' },
    });
    expect(result.changed).toEqual([]);
    expect(result.nextVersions).toEqual({ mdi: '2.2.400' });
  });

  test('flags only the outdated collection', () => {
    const result = detectChanges({
      collections: ['mdi', 'lucide', 'heroicons'],
      currentVersion: '2.2.400',
      storedVersions: { mdi: '2.2.400', lucide: '2.2.399', heroicons: '2.2.400' },
    });
    expect(result.changed).toEqual(['lucide']);
    expect(result.nextVersions).toEqual({
      mdi: '2.2.400',
      lucide: '2.2.400',
      heroicons: '2.2.400',
    });
  });

  test('preserves order from collections input', () => {
    const result = detectChanges({
      collections: ['heroicons', 'mdi', 'lucide'],
      currentVersion: '2.2.400',
      storedVersions: {},
    });
    expect(result.changed).toEqual(['heroicons', 'mdi', 'lucide']);
  });

  test('preserves versions of collections outside the input list', () => {
    const result = detectChanges({
      collections: ['mdi'],
      currentVersion: '2.2.500',
      storedVersions: { mdi: '2.2.400', lucide: '2.2.400', heroicons: '2.2.400' },
    });
    expect(result.changed).toEqual(['mdi']);
    expect(result.nextVersions).toEqual({
      mdi: '2.2.500',
      lucide: '2.2.400',
      heroicons: '2.2.400',
    });
  });
});

describe('readIconifyVersion', () => {
  test('returns a semver-shaped string from installed @iconify/json', async () => {
    const v = await readIconifyVersion();
    expect(v).toMatch(/^\d+\.\d+\.\d+/);
  });
});
