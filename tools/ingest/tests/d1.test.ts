import { describe, expect, test, vi } from 'vitest';
import { D1Client, D1Error } from '../src/d1.ts';

const cfg = { apiToken: 'tok', accountId: 'acct', databaseId: 'db' };

const jsonRes = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

describe('D1Client.execute', () => {
  test('POSTs SQL to the query endpoint with the bearer token', async () => {
    const fetchFn = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
      jsonRes({
        success: true,
        result: [
          {
            success: true,
            meta: { changes: 1, last_row_id: 42 },
            results: [{ id: 42 }],
          },
        ],
      }),
    );
    const client = new D1Client(cfg, fetchFn);
    const result = await client.execute('SELECT id FROM icons WHERE name = ?', ['home']);
    expect(result.meta.changes).toBe(1);
    expect(result.results[0]).toEqual({ id: 42 });
    const call = fetchFn.mock.calls[0];
    const url = call?.[0] as string;
    const init = call?.[1] as RequestInit;
    expect(url).toContain('/accounts/acct/d1/database/db/query');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    expect(init.method).toBe('POST');
  });

  test('throws D1Error when Cloudflare reports failure', async () => {
    const fetchFn = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
      jsonRes(
        {
          success: false,
          errors: [{ code: 7500, message: 'syntax error' }],
        },
        400,
      ),
    );
    const client = new D1Client(cfg, fetchFn);
    await expect(client.execute('BOOM')).rejects.toBeInstanceOf(D1Error);
  });
});

describe('D1Client.batchAtomic', () => {
  test('posts statements as JSON array and returns per-statement results', async () => {
    const seen: unknown[] = [];
    const fetchImpl = async (url: string, init?: RequestInit) => {
      seen.push({ url, body: init?.body });
      return new Response(
        JSON.stringify({
          success: true,
          result: [
            { success: true, meta: { changes: 3, last_row_id: null }, results: [] },
            { success: true, meta: { changes: 1, last_row_id: 42 }, results: [] },
          ],
        }),
        { status: 200 },
      );
    };
    const client = new D1Client(
      { apiToken: 't', accountId: 'a', databaseId: 'd' },
      fetchImpl as typeof fetch,
    );
    const results = await client.batchAtomic([
      { sql: 'DELETE FROM icons WHERE collection = ?', params: ['mdi'] },
      {
        sql: 'INSERT INTO icons (id, collection, name, license, updated_at) VALUES (?, ?, ?, ?, ?)',
        params: [1, 'mdi', 'home', 'Apache-2.0', 100],
      },
    ]);
    expect(results.map((r) => r.meta.changes)).toEqual([3, 1]);
    const body = JSON.parse((seen[0] as { body: string }).body);
    expect(body.sql).toBe(
      'DELETE FROM icons WHERE collection = ?; INSERT INTO icons (id, collection, name, license, updated_at) VALUES (?, ?, ?, ?, ?)',
    );
    expect(body.params).toEqual(['mdi', 1, 'mdi', 'home', 'Apache-2.0', 100]);
  });

  test('throws D1Error on non-success', async () => {
    const fetchImpl = async () =>
      new Response(JSON.stringify({ success: false, errors: [{ code: 8000, message: 'x' }] }), {
        status: 500,
      });
    const client = new D1Client(
      { apiToken: 't', accountId: 'a', databaseId: 'd' },
      fetchImpl as typeof fetch,
    );
    await expect(client.batchAtomic([{ sql: 'DELETE FROM icons' }])).rejects.toThrow(
      'D1 request failed',
    );
  });
});
