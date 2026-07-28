import { env } from 'cloudflare:test';
// `?raw` inlines the SQL text at bundle time, avoiding runtime filesystem
// access inside the Workers sandbox (node:fs there is a virtual/isolated FS
// and cannot read real host paths).
import seedSql from './seed.sql?raw';

export const seedTestDb = async (): Promise<void> => {
  const stmts = seedSql
    .split(/;\s*(?=(?:CREATE|INSERT)\b)/i)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const s of stmts) await env.DB.prepare(s.replace(/;\s*$/, '')).run();
};

export const putIconFixture = async (collection: string, body: unknown): Promise<void> => {
  await env.ICONS.put(`iconify/${collection}.json`, JSON.stringify(body), {
    httpMetadata: { contentType: 'application/json' },
  });
};
