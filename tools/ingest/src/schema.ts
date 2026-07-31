import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { splitStatements } from '@icon-collection/core';
import type { D1Client } from './d1.ts';

const schemaPath = fileURLToPath(new URL('./schema.sql', import.meta.url));
const raw = await readFile(schemaPath, 'utf-8');

/** DDL only — split on CREATE/DROP/ALTER/BEGIN/END keywords. */
export const SCHEMA_STATEMENTS: readonly string[] = splitStatements(raw, {
  keywords: ['CREATE', 'DROP', 'ALTER', 'BEGIN', 'END'],
});

export const applySchema = async (d1: D1Client): Promise<void> => {
  for (const stmt of SCHEMA_STATEMENTS) {
    await d1.execute(stmt);
  }
};
