import { loadDictionary, type SynonymDictionary } from '@icon-collection/synonyms';
import type { D1Client } from './d1.ts';
import { sqlLiteral } from './sql-literal.ts';

// Rows per INSERT statement (see seed-icons.ts for rationale).
const DEFAULT_BATCH_SIZE = 500;

const buildInsertSql = (rows: readonly string[]): string =>
  `INSERT INTO synonyms (term, expansion, lang, weight) VALUES ${rows.join(', ')}`;

export type SeedSynonymsInput = {
  d1: D1Client;
  dictionaries?: readonly SynonymDictionary[];
  batchSize?: number;
};

export const seedSynonyms = async (input: SeedSynonymsInput): Promise<{ inserted: number }> => {
  const batchSize = input.batchSize ?? DEFAULT_BATCH_SIZE;
  const dicts = input.dictionaries ?? [loadDictionary('ja'), loadDictionary('en')];
  const entries = dicts.flatMap((d) => Array.from(d));

  await input.d1.execute('DELETE FROM synonyms');

  if (entries.length === 0) return { inserted: 0 };

  let inserted = 0;
  for (let offset = 0; offset < entries.length; offset += batchSize) {
    const chunk = entries.slice(offset, offset + batchSize);
    const rows = chunk.map((entry) => {
      const values = [
        sqlLiteral(entry.term),
        sqlLiteral(entry.expansion),
        sqlLiteral(entry.lang),
        sqlLiteral(entry.weight ?? 1.0),
      ].join(', ');
      return `(${values})`;
    });
    const result = await input.d1.execute(buildInsertSql(rows));
    inserted += result.meta.changes;
  }
  return { inserted };
};
