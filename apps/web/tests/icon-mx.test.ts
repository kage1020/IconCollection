import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { onRequest } from '../functions/icon/[collection]/[name].mx.ts';
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
    request: new Request(`https://x/icon/${collection}/${name}.mx`),
    env,
    params: { collection, name },
    next: async () => new Response(),
    data: {},
    waitUntil: ctx.waitUntil,
    passThroughOnException: () => undefined,
    functionPath: `/icon/${collection}/${name}.mx`,
  } as never);
  await waitOnExecutionContext(ctx);
  return res;
};

beforeEach(async () => {
  await putIconFixture('mdi', FIX);
});

describe('GET /icon/{collection}/{name}.mx', () => {
  it('returns mxLibrary XML wrapping the SVG', async () => {
    const res = await call('mdi', 'home');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/xml');
    const body = await res.text();
    expect(body).toContain('<mxGraphModel>');
    expect(body).toContain('data:image/svg+xml,');
  });

  it('returns 404 when icon missing', async () => {
    const res = await call('mdi', 'unknown-icon');
    expect(res.status).toBe(404);
  });
});
