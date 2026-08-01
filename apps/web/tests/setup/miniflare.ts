import { env } from 'cloudflare:workers';
// `?raw` inlines the SQL text at bundle time, avoiding runtime filesystem
// access inside the Workers sandbox (node:fs there is a virtual/isolated FS
// and cannot read real host paths).
import seedSql from './seed.sql?raw';

// The Workers pool does not roll back D1 storage between individual `it()`
// blocks within the same file (only vitest's own state is test-scoped), so
// re-running this seed in `beforeEach` would violate UNIQUE constraints on
// the second call. Clear the plain tables before re-inserting so the seed
// is idempotent across repeated calls; `icons_fts` resyncs via its own
// `rebuild` statement in seed.sql, so it is left untouched here.
const RESEEDABLE_TABLES = ['icons', 'collection_meta', 'synonyms'] as const;

export const seedTestDb = async (): Promise<void> => {
  const stmts = seedSql
    .split(/;\s*(?=(?:CREATE|INSERT)\b)/i)
    .map((s) => s.trim())
    .filter(Boolean);
  const creates = stmts.filter((s) => /^CREATE\b/i.test(s));
  const inserts = stmts.filter((s) => /^INSERT\b/i.test(s));
  for (const s of creates) await env.DB.prepare(s.replace(/;\s*$/, '')).run();
  for (const table of RESEEDABLE_TABLES) await env.DB.prepare(`DELETE FROM ${table}`).run();
  for (const s of inserts) await env.DB.prepare(s.replace(/;\s*$/, '')).run();
};

export const putIconFixture = async (collection: string, body: unknown): Promise<void> => {
  await env.ICONS.put(`iconify/${collection}.json`, JSON.stringify(body), {
    httpMetadata: { contentType: 'application/json' },
  });
};
