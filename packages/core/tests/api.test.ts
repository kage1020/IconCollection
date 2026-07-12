import { describe, expect, test, vi } from 'vitest';
import { ApiError, createApiClient } from '../src/index.ts';

const jsonResponse = (body: unknown, init?: ResponseInit): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });

const textResponse = (body: string, init?: ResponseInit): Response =>
  new Response(body, {
    status: 200,
    headers: { 'content-type': 'image/svg+xml' },
    ...init,
  });

describe('search', () => {
  test('builds URL with query params and returns SearchResponse', async () => {
    const fetchFn = vi.fn(async (_url: RequestInfo | URL) =>
      jsonResponse({ hits: [], total: 0, cursor: null }),
    );
    const client = createApiClient({ baseUrl: 'https://x.example', fetch: fetchFn });
    const res = await client.search({
      q: 'home',
      collection: ['mdi', 'lucide'],
      license: ['MIT'],
      limit: 30,
    });
    expect(res.total).toBe(0);
    const url = fetchFn.mock.calls[0]?.[0] as URL;
    expect(url.pathname).toBe('/api/search');
    expect(url.searchParams.get('q')).toBe('home');
    expect(url.searchParams.get('collection')).toBe('mdi,lucide');
    expect(url.searchParams.get('license')).toBe('MIT');
    expect(url.searchParams.get('limit')).toBe('30');
  });

  test('throws ApiError on non-2xx', async () => {
    const fetchFn = vi.fn(async (_url: RequestInfo | URL) => new Response('bad', { status: 500 }));
    const client = createApiClient({ baseUrl: 'https://x.example', fetch: fetchFn });
    await expect(client.search({ q: 'home' })).rejects.toBeInstanceOf(ApiError);
  });
});

describe('getSvg', () => {
  test('returns text body', async () => {
    const fetchFn = vi.fn(async (_url: RequestInfo | URL) => textResponse('<svg/>'));
    const client = createApiClient({ baseUrl: 'https://x.example/', fetch: fetchFn });
    expect(await client.getSvg('mdi', 'home')).toBe('<svg/>');
    const url = fetchFn.mock.calls[0]?.[0] as URL;
    expect(url.pathname).toBe('/icon/mdi/home.svg');
  });

  test('throws ApiError on 404', async () => {
    const fetchFn = vi.fn(
      async (_url: RequestInfo | URL) => new Response('missing', { status: 404 }),
    );
    const client = createApiClient({ baseUrl: 'https://x.example', fetch: fetchFn });
    await expect(client.getSvg('mdi', 'unknown')).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe('getMx', () => {
  test('hits /icon/:c/:n.mx and returns text', async () => {
    const fetchFn = vi.fn(
      async (_url: RequestInfo | URL) => new Response('<mxGraphModel/>', { status: 200 }),
    );
    const client = createApiClient({ baseUrl: 'https://x.example', fetch: fetchFn });
    expect(await client.getMx('mdi', 'home')).toBe('<mxGraphModel/>');
    const url = fetchFn.mock.calls[0]?.[0] as URL;
    expect(url.pathname).toBe('/icon/mdi/home.mx');
  });
});
