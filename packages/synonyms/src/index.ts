import en from './dictionaries/en.json' with { type: 'json' };
import ja from './dictionaries/ja.json' with { type: 'json' };
import type { SynonymDictionary, SynonymLang } from './schema.ts';
import { validateDictionary } from './schema.ts';

const dictionaries: Record<SynonymLang, SynonymDictionary> = {
  ja: validateDictionary(ja),
  en: validateDictionary(en),
};

export const loadDictionary = (lang: SynonymLang): SynonymDictionary => dictionaries[lang];

export type { SynonymDictionary, SynonymEntry, SynonymLang } from './schema.ts';
export { validateDictionary } from './schema.ts';
