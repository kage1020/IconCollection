import { describe, expect, test, vi } from 'vitest';
import type { D1Client } from '../src/d1.ts';
import { rebuildFts } from '../src/seed-fts.ts';

const ok = { success: true, meta: { changes: 0, last_row_id: null }, results: [] };

describe('rebuildFts', () => {
  test('runs the FTS5 rebuild pragma', async () => {
    const execute = vi.fn(async (_sql: string, _params?: readonly unknown[]) => ok);
    const client = { execute } as unknown as D1Client;
    await rebuildFts(client);
    const sql = execute.mock.calls[0]?.[0] as string;
    expect(sql).toBe("INSERT INTO icons_fts(icons_fts) VALUES('rebuild')");
  });
});
