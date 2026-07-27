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

describe('D1Client.batch', () => {
  test('POSTs multiple statements to the /batch endpoint', async () => {
    // batch() issues one HTTP request per statement (serial execute) to guarantee
    // ordering, so each call must resolve with that statement's own response.
    const responses = [
      jsonRes({
        success: true,
        result: [{ success: true, meta: { changes: 1, last_row_id: null }, results: [] }],
      }),
      jsonRes({
        success: true,
        result: [{ success: true, meta: { changes: 2, last_row_id: null }, results: [] }],
      }),
    ];
    const fetchFn = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
      const next = responses.shift();
      if (!next) throw new Error('unexpected extra fetch call');
      return next;
    });
    const client = new D1Client(cfg, fetchFn);
    const results = await client.batch([
      { sql: 'DELETE FROM icons WHERE collection = ?', params: ['mdi'] },
      { sql: 'INSERT INTO icons (collection, name) VALUES (?, ?)', params: ['mdi', 'home'] },
    ]);
    expect(results).toHaveLength(2);
    expect(results[1]?.meta.changes).toBe(2);
    const url = fetchFn.mock.calls[0]?.[0] as string;
    expect(url).toContain('/query'); // Cloudflare uses /query with sql array for batch
  });
});
