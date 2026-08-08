import type { SearchQuery, SearchResponse } from './types.ts';

export type ApiClientConfig = {
  baseUrl: string;
  fetch?: typeof fetch;
};

export class ApiError extends Error {
  readonly status: number;
  readonly url: string;
  constructor(input: { status: number; url: string; message?: string }) {
    super(input.message ?? `API request failed: ${input.status} ${input.url}`);
    this.name = 'ApiError';
    this.status = input.status;
    this.url = input.url;
  }
}

export type ApiClient = {
  search: (query: SearchQuery) => Promise<SearchResponse>;
  getSvg: (collection: string, name: string) => Promise<string>;
  getMx: (collection: string, name: string) => Promise<string>;
};

const buildUrl = (base: string, path: string): URL => {
  const normalized = base.endsWith('/') ? base : `${base}/`;
  return new URL(path.replace(/^\//, ''), normalized);
};

export const createApiClient = (config: ApiClientConfig): ApiClient => {
  const fetchFn = config.fetch ?? globalThis.fetch;
  const request = async (url: URL): Promise<Response> => {
    const res = await fetchFn(url);
    if (!res.ok) throw new ApiError({ status: res.status, url: url.toString() });
    return res;
  };

  return {
    search: async (query) => {
      const url = buildUrl(config.baseUrl, 'api/search');
      url.searchParams.set('q', query.q);
      // Repeat the parameter once per value (`?collection=a&collection=b`)
      // so the server's `getAll('collection')` sees each collection as a
      // separate string. Comma-joining would push `"a,b"` as a single
      // literal into the SQL `IN (...)` list and match zero rows.
      for (const c of query.collection ?? []) url.searchParams.append('collection', c);
      for (const l of query.license ?? []) url.searchParams.append('license', l);
      if (typeof query.limit === 'number') {
        url.searchParams.set('limit', String(query.limit));
      }
      if (query.cursor) url.searchParams.set('cursor', query.cursor);
      const res = await request(url);
      return (await res.json()) as SearchResponse;
    },
    getSvg: async (collection, name) => {
      const url = buildUrl(
        config.baseUrl,
        `icon/${encodeURIComponent(collection)}/${encodeURIComponent(name)}.svg`,
      );
      const res = await request(url);
      return res.text();
    },
    getMx: async (collection, name) => {
      const url = buildUrl(
        config.baseUrl,
        `icon/${encodeURIComponent(collection)}/${encodeURIComponent(name)}.mx`,
      );
      const res = await request(url);
      return res.text();
    },
  };
};
