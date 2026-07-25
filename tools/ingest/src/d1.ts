import type { IngestConfig } from './types.ts';

export type D1Row = Record<string, unknown>;

export type D1Result = {
  success: boolean;
  meta: { changes: number; last_row_id: number | null };
  results: D1Row[];
};

type D1Response = {
  success: boolean;
  result?: Array<{
    success: boolean;
    meta: { changes: number; last_row_id: number | null };
    results: D1Row[];
  }>;
  errors?: Array<{ code: number; message: string }>;
};

export class D1Error extends Error {
  readonly status: number;
  readonly errors: readonly { code: number; message: string }[];
  constructor(input: { status: number; errors: readonly { code: number; message: string }[] }) {
    super(`D1 request failed: status=${input.status} ${JSON.stringify(input.errors)}`);
    this.name = 'D1Error';
    this.status = input.status;
    this.errors = input.errors;
  }
}

export class D1Client {
  private readonly cfg: IngestConfig['d1'];
  private readonly fetchImpl: typeof fetch;
  private readonly endpoint: string;

  constructor(cfg: IngestConfig['d1'], fetchImpl?: typeof fetch) {
    this.cfg = cfg;
    this.fetchImpl = fetchImpl ?? globalThis.fetch;
    this.endpoint = `https://api.cloudflare.com/client/v4/accounts/${cfg.accountId}/d1/database/${cfg.databaseId}/query`;
  }

  async execute(sql: string, params?: readonly unknown[]): Promise<D1Result> {
    const res = await this.fetchImpl(this.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.cfg.apiToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ sql, params: params ?? [] }),
    });
    const body = (await res.json()) as D1Response;
    if (!res.ok || !body.success) {
      throw new D1Error({
        status: res.status,
        errors: body.errors ?? [{ code: -1, message: 'unknown' }],
      });
    }
    const first = body.result?.[0];
    if (!first) {
      throw new D1Error({
        status: res.status,
        errors: [{ code: -2, message: 'missing result' }],
      });
    }
    return first;
  }

  async batch(stmts: readonly { sql: string; params?: readonly unknown[] }[]): Promise<D1Result[]> {
    const results: D1Result[] = [];
    for (const stmt of stmts) {
      results.push(await this.execute(stmt.sql, stmt.params));
    }
    return results;
  }
}
