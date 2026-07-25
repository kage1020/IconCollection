import { loadDictionary, type SynonymDictionary } from '@icon-collection/synonyms';
import type { D1Client } from './d1.ts';

const DEFAULT_BATCH_SIZE = 500;

const buildInsertSql = (rowCount: number): string => {
  const placeholders = Array.from({ length: rowCount }, () => '(?, ?, ?, ?)').join(', ');
  return `INSERT INTO synonyms (term, expansion, lang, weight) VALUES ${placeholders}`;
};

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
  let inserted = 0;
  for (let offset = 0; offset < entries.length; offset += batchSize) {
    const chunk = entries.slice(offset, offset + batchSize);
    const params: unknown[] = [];
    for (const entry of chunk) {
      params.push(entry.term, entry.expansion, entry.lang, entry.weight ?? 1.0);
    }
    await input.d1.execute(buildInsertSql(chunk.length), params);
    inserted += chunk.length;
  }
  return { inserted };
};
