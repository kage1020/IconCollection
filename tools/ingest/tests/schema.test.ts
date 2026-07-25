import { describe, expect, test, vi } from 'vitest';
import type { D1Client } from '../src/d1.ts';
import { applySchema, SCHEMA_STATEMENTS } from '../src/schema.ts';

describe('SCHEMA_STATEMENTS', () => {
  test('contains create statements for icons, icons_fts, synonyms, collection_meta', () => {
    const joined = SCHEMA_STATEMENTS.join('\n');
    expect(joined).toMatch(/CREATE TABLE IF NOT EXISTS icons\b/);
    expect(joined).toMatch(/CREATE VIRTUAL TABLE IF NOT EXISTS icons_fts/);
    expect(joined).toMatch(/CREATE TABLE IF NOT EXISTS synonyms/);
    expect(joined).toMatch(/CREATE TABLE IF NOT EXISTS collection_meta/);
    expect(SCHEMA_STATEMENTS.length).toBeGreaterThanOrEqual(5);
  });

  test('each statement ends without a trailing semicolon', () => {
    for (const stmt of SCHEMA_STATEMENTS) {
      expect(stmt.trim().endsWith(';')).toBe(false);
    }
  });
});

describe('applySchema', () => {
  test('executes every statement against the D1 client', async () => {
    const execute = vi.fn(async () => ({
      success: true,
      meta: { changes: 0, last_row_id: null },
      results: [],
    }));
    const client = { execute } as unknown as D1Client;
    await applySchema(client);
    expect(execute).toHaveBeenCalledTimes(SCHEMA_STATEMENTS.length);
  });
});
