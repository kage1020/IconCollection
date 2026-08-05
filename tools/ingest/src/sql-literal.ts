// SQL literal serializer for building parameter-less multi-value INSERT statements.
// Cloudflare D1 HTTP `/query` does not support params + multi-statement (and single
// statements with thousands of bind params exceed the per-statement limit anyway),
// so bulk ingest inlines values as escaped SQL literals. All ingested strings come
// from `@iconify/json` and `@icon-collection/synonyms` — trusted sources — but the
// escaping is defensive against `'` in icon names, aliases, and category labels.

export const sqlLiteral = (value: unknown): string => {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`sqlLiteral: non-finite number ${value}`);
    }
    return String(value);
  }
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
  throw new Error(`sqlLiteral: unsupported type ${typeof value}`);
};
