import { createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import { onRequest } from '../functions/icon/[collection]/[name].svg.ts';
import { putIconFixture } from './setup/miniflare.ts';

const FIX = {
  prefix: 'mdi',
  info: { name: 'MDI' },
  width: 24,
  height: 24,
  icons: { home: { body: '<path d="M0 0h24v24H0z"/>' } },
};

const call = async (collection: string, name: string): Promise<Response> => {
  const ctx = createExecutionContext();
  const res = await onRequest({
    request: new Request(`https://x/icon/${collection}/${name}.svg`),
    env,
    params: { collection, name },
    next: async () => new Response(),
    data: {},
    waitUntil: ctx.waitUntil,
    passThroughOnException: () => undefined,
    functionPath: `/icon/${collection}/${name}.svg`,
  } as never);
  await waitOnExecutionContext(ctx);
  return res;
};

beforeEach(async () => {
  await putIconFixture('mdi', FIX);
});

describe('GET /icon/{collection}/{name}.svg', () => {
  it('returns valid SVG with immutable cache headers', async () => {
    const res = await call('mdi', 'home');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('image/svg+xml');
    expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    expect(res.headers.get('etag')).toMatch(/^"sha256:[a-f0-9]{8}"$/);
    const body = await res.text();
    expect(body).toContain('viewBox="0 0 24 24"');
    expect(body).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(body).toContain('<path d="M0 0h24v24H0z"/>');
  });

  it('returns 404 when icon missing', async () => {
    const res = await call('mdi', 'unknown-icon');
    expect(res.status).toBe(404);
  });

  it('returns 500 when body contains <script>', async () => {
    await putIconFixture('bad', {
      prefix: 'bad',
      info: { name: 'Bad' },
      width: 24,
      height: 24,
      icons: { evil: { body: '<script>alert(1)</script>' } },
    });
    const res = await call('bad', 'evil');
    expect(res.status).toBe(500);
  });
});
