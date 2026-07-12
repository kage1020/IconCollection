export type SynonymLang = 'ja' | 'en';

export type SynonymEntry = {
  term: string;
  expansion: string;
  lang: SynonymLang;
  weight?: number;
};

export type SynonymDictionary = readonly SynonymEntry[];

const isString = (v: unknown): v is string => typeof v === 'string';
const isLang = (v: unknown): v is SynonymLang => v === 'ja' || v === 'en';

export const validateDictionary = (input: unknown): SynonymDictionary => {
  if (!Array.isArray(input)) {
    throw new Error('synonym dictionary must be an array');
  }
  const validated: SynonymEntry[] = [];
  for (const [i, raw] of input.entries()) {
    if (typeof raw !== 'object' || raw === null) {
      throw new Error(`entry[${i}] must be an object`);
    }
    const entry = raw as Record<string, unknown>;
    if (!isString(entry.term)) throw new Error(`entry[${i}].term must be a string`);
    if (!isString(entry.expansion)) {
      throw new Error(`entry[${i}].expansion must be a string`);
    }
    if (!isLang(entry.lang)) throw new Error(`entry[${i}].lang must be 'ja' or 'en'`);
    const item: SynonymEntry = {
      term: entry.term,
      expansion: entry.expansion,
      lang: entry.lang,
    };
    if (typeof entry.weight === 'number') item.weight = entry.weight;
    validated.push(item);
  }
  return validated;
};
