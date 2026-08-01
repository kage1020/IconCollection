import type { D1Result } from '../src/d1.ts';

const rowCountFromSql = (sql: string): number => {
  const matches = sql.match(/\([^()]*\?[^()]*\)/g);
  return matches?.length ?? 0;
};

export const makeFakeBatchAtomic =
  (): ((stmts: readonly { sql: string; params?: readonly unknown[] }[]) => Promise<D1Result[]>) =>
  async (stmts) =>
    stmts.map((stmt) => ({
      success: true,
      meta: {
        changes: stmt.sql.startsWith('INSERT') ? rowCountFromSql(stmt.sql) : 0,
        last_row_id: null,
      },
      results: [],
    }));
