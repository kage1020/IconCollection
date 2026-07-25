import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

export type DetectInput = {
  collections: readonly string[];
  currentVersion: string;
  storedVersions: Record<string, string>;
};

export type DetectResult = {
  changed: string[];
  nextVersions: Record<string, string>;
};

export const detectChanges = (input: DetectInput): DetectResult => {
  const changed: string[] = [];
  const nextVersions: Record<string, string> = { ...input.storedVersions };
  for (const collection of input.collections) {
    nextVersions[collection] = input.currentVersion;
    if (input.storedVersions[collection] !== input.currentVersion) {
      changed.push(collection);
    }
  }
  return { changed, nextVersions };
};

export const readIconifyVersion = async (): Promise<string> => {
  const require = createRequire(import.meta.url);
  const pkgPath = require.resolve('@iconify/json/package.json');
  const raw = await readFile(pkgPath, 'utf-8');
  const pkg = JSON.parse(raw) as { version: string };
  return pkg.version;
};
