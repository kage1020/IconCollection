import type { D1Client } from './d1.ts';
import { sqlLiteral } from './sql-literal.ts';
import type { CollectionSnapshot, IconifyJSON } from './types.ts';

// Rows per INSERT statement. Bounded by D1's per-statement size limit
// (SQLITE_LIMIT_SQL_LENGTH, roughly 100 KB). At ~100 chars/row this gives ~50 KB
// per statement, leaving comfortable margin. Empirically 2000 rows already trips
// "SQLITE_TOOBIG" for verbose collections like MDI.
const DEFAULT_BATCH_SIZE = 500;

type IconMeta = {
  categories: string | null;
  tags: string | null;
  aliases: string | null;
};

const buildIndex = (body: IconifyJSON): Map<string, IconMeta> => {
  const index = new Map<string, IconMeta>();
  for (const name of Object.keys(body.icons)) {
    index.set(name, { categories: null, tags: null, aliases: null });
  }
  const cats = (body as { categories?: Record<string, string[]> }).categories;
  if (cats) {
    for (const [category, names] of Object.entries(cats)) {
      for (const name of names) {
        const meta = index.get(name);
        if (!meta) continue;
        meta.categories = meta.categories ? `${meta.categories},${category}` : category;
      }
    }
  }
  const aliases = (body as { aliases?: Record<string, { parent?: string }> }).aliases;
  if (aliases) {
    for (const [alias, def] of Object.entries(aliases)) {
      const parent = def.parent;
      if (!parent) continue;
      const meta = index.get(parent);
      if (!meta) continue;
      meta.aliases = meta.aliases ? `${meta.aliases},${alias}` : alias;
    }
  }
  return index;
};

const buildInsertSql = (rows: readonly string[]): string =>
  `INSERT INTO icons (collection, name, license, categories, tags, aliases, updated_at) VALUES ${rows.join(', ')}`;

export type SeedIconsInput = {
  d1: D1Client;
  snapshots: readonly CollectionSnapshot[];
  batchSize?: number;
};

export const seedIcons = async (
  input: SeedIconsInput,
): Promise<{ deleted: number; inserted: number }> => {
  const batchSize = input.batchSize ?? DEFAULT_BATCH_SIZE;
  let deleted = 0;
  let inserted = 0;
  for (const snap of input.snapshots) {
    const index = buildIndex(snap.body);
    const names = Object.keys(snap.body.icons);
    const updatedAt = Math.floor(Date.now() / 1000);

    await input.d1.execute(`DELETE FROM icons WHERE collection = ${sqlLiteral(snap.collection)}`);
    deleted++;

    if (names.length === 0) continue;

    for (let offset = 0; offset < names.length; offset += batchSize) {
      const chunk = names.slice(offset, offset + batchSize);
      const rows = chunk.map((name) => {
        const meta = index.get(name);
        const values = [
          sqlLiteral(snap.collection),
          sqlLiteral(name),
          sqlLiteral(snap.license),
          sqlLiteral(meta?.categories ?? null),
          sqlLiteral(meta?.tags ?? null),
          sqlLiteral(meta?.aliases ?? null),
          sqlLiteral(updatedAt),
        ].join(', ');
        return `(${values})`;
      });
      const result = await input.d1.execute(buildInsertSql(rows));
      inserted += result.meta.changes;
    }
  }
  return { deleted, inserted };
};
