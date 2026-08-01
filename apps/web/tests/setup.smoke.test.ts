import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { seedTestDb } from './setup/miniflare.ts';

describe('miniflare setup', () => {
  it('creates DB and inserts seed rows', async () => {
    await seedTestDb();
    const rows = await env.DB.prepare('SELECT COUNT(*) as n FROM icons').all();
    expect((rows.results[0] as { n: number }).n).toBe(2);
  });
});
