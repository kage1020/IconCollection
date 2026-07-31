import type { D1Client } from './d1.ts';
import type { CollectionSnapshot, IconifyJSON } from './types.ts';

const DEFAULT_BATCH_SIZE = 10;

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

const buildInsertSql = (rowCount: number): string => {
  const placeholders = Array.from({ length: rowCount }, () => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
  return `INSERT INTO icons (collection, name, license, categories, tags, aliases, updated_at) VALUES ${placeholders}`;
};

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
    const statements: { sql: string; params: readonly unknown[] }[] = [
      { sql: 'DELETE FROM icons WHERE collection = ?', params: [snap.collection] },
    ];
    for (let offset = 0; offset < names.length; offset += batchSize) {
      const chunk = names.slice(offset, offset + batchSize);
      const params: unknown[] = [];
      for (const name of chunk) {
        const meta = index.get(name);
        params.push(
          snap.collection,
          name,
          snap.license,
          meta?.categories ?? null,
          meta?.tags ?? null,
          meta?.aliases ?? null,
          updatedAt,
        );
      }
      statements.push({ sql: buildInsertSql(chunk.length), params });
    }
    const results = await input.d1.batchAtomic(statements);
    deleted++;
    inserted += results.slice(1).reduce((n, r) => n + r.meta.changes, 0);
  }
  return { deleted, inserted };
};
