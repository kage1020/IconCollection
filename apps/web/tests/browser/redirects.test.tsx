import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const redirectsPath = resolve(process.cwd(), 'public/_redirects');

describe('_redirects', () => {
  it('redirects legacy SVG URLs to /icon path', async () => {
    const content = await readFile(redirectsPath, 'utf-8');
    expect(content).toContain('/:collection/:name.svg /icon/:collection/:name.svg 301');
  });

  it('redirects legacy MX URLs to /icon path', async () => {
    const content = await readFile(redirectsPath, 'utf-8');
    expect(content).toContain('/:collection/:name.mx /icon/:collection/:name.mx 301');
  });

  it('has no wildcard that could catch /api/*', async () => {
    const content = await readFile(redirectsPath, 'utf-8');
    // Each redirect must have a specific extension suffix
    const lines = content.split('\n').filter((l) => l.trim() && !l.startsWith('#'));
    for (const line of lines) {
      const [from] = line.split(/\s+/);
      expect(from).toMatch(/\.(svg|mx)$/);
    }
  });
});
