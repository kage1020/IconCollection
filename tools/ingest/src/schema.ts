import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { D1Client } from './d1.ts';

const schemaPath = fileURLToPath(new URL('./schema.sql', import.meta.url));
const raw = await readFile(schemaPath, 'utf-8');

export const SCHEMA_STATEMENTS: readonly string[] = raw
  .split(/;\s*(?=CREATE|DROP|ALTER|BEGIN|END)/i)
  .map((s) => s.replace(/;\s*$/, '').trim())
  .filter((s) => s.length > 0);

export const applySchema = async (d1: D1Client): Promise<void> => {
  for (const stmt of SCHEMA_STATEMENTS) {
    await d1.execute(stmt);
  }
};
