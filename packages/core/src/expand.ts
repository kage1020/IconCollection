import type { SynonymDictionary } from '@icon-collection/synonyms';
import { normalizeQuery } from './query.ts';

export const expandQuery = (input: string, dicts: readonly SynonymDictionary[]): string[] => {
  const normalized = normalizeQuery(input);
  if (normalized.length === 0) return [];
  const terms = normalized.split(/\s+/).filter((t) => t.length > 0);
  if (terms.length === 0) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (v: string): void => {
    if (seen.has(v)) return;
    seen.add(v);
    out.push(v);
  };
  for (const term of terms) push(term);
  for (const term of terms) {
    for (const dict of dicts) {
      for (const entry of dict) {
        if (entry.term === term) push(entry.expansion);
      }
    }
  }
  return out;
};
