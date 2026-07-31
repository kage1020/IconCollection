export type SplitOptions = { keywords: readonly string[] };

export const splitStatements = (sql: string, opts: SplitOptions): readonly string[] => {
  if (opts.keywords.length === 0) return sql.trim().length > 0 ? [sql.trim()] : [];
  const escaped = opts.keywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`;\\s*(?=(?:${escaped.join('|')})\\b)`, 'i');
  return sql
    .split(pattern)
    .map((s) => s.replace(/;[\s;]*$/, '').trim())
    .filter((s) => s.length > 0);
};
