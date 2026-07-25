const FTS5_RESERVED = /["*()]/g;

export const normalizeQuery = (input: string): string =>
  input.normalize('NFKC').trim().toLowerCase();

export const buildFtsQuery = (terms: readonly string[]): string => {
  const cleaned = terms.map((t) => t.replace(FTS5_RESERVED, '').trim()).filter((t) => t.length > 0);
  if (cleaned.length === 0) return '';
  return cleaned.map((t) => `"${t}"`).join(' OR ');
};
