import { beforeEach, describe, expect, it } from 'vitest';
import { GET } from '../src/pages/api/search.ts';
import { seedTestDb } from './setup/miniflare.ts';

const call = async (url: string): Promise<Response> => {
  const request = new Request(`https://x${url}`);
  return GET({
    request,
    params: {},
  } as unknown as Parameters<typeof GET>[0]);
};

beforeEach(() => seedTestDb());

describe('GET /api/search', () => {
  it('returns matching hits with width/height from collection_meta', async () => {
    const res = await call('/api/search?q=home');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { hits: unknown[]; total: number; cursor: string | null };
    expect(body.total).toBe(2);
    expect(body.hits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ collection: 'mdi', name: 'home', width: 24, height: 24 }),
        expect.objectContaining({ collection: 'lucide', name: 'home', width: 24, height: 24 }),
      ]),
    );
  });

  it('expands query via synonyms (house → home)', async () => {
    const res = await call('/api/search?q=house');
    const body = (await res.json()) as { total: number };
    expect(body.total).toBeGreaterThanOrEqual(1);
  });

  it('filters by collection', async () => {
    const res = await call('/api/search?q=home&collection=mdi');
    const body = (await res.json()) as { hits: Array<{ collection: string }>; total: number };
    expect(body.total).toBe(1);
    expect(body.hits[0]?.collection).toBe('mdi');
  });

  it('returns 400 when q is missing', async () => {
    const res = await call('/api/search');
    expect(res.status).toBe(400);
  });

  it('returns 400 when limit exceeds 200', async () => {
    const res = await call('/api/search?q=home&limit=201');
    expect(res.status).toBe(400);
  });

  it('returns cursor for further pagination when total > limit', async () => {
    const res = await call('/api/search?q=home&limit=1');
    const body = (await res.json()) as { cursor: string | null; total: number };
    expect(body.total).toBe(2);
    expect(typeof body.cursor).toBe('string');
  });

  it('sets cache-control: no-store when expandQuery yields empty FTS terms', async () => {
    const res = await call('/api/search?q=%2A');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { hits: unknown[]; total: number; cursor: string | null };
    expect(body.hits).toEqual([]);
    expect(body.total).toBe(0);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
});
