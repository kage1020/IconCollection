import { createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test';
import { expect, it } from 'vitest';
import { onRequest as middleware } from '../functions/_middleware.ts';

it('adds CSP and X-Content-Type-Options headers to next response', async () => {
  const nextRes = new Response('ok');
  const ctx = createExecutionContext();
  const res = await middleware({
    request: new Request('https://x/'),
    env,
    params: {},
    data: {},
    next: async () => nextRes,
    waitUntil: ctx.waitUntil,
    passThroughOnException: () => undefined,
    functionPath: '/',
  } as never);
  await waitOnExecutionContext(ctx);
  expect(res.headers.get('content-security-policy')).toContain("default-src 'self'");
  expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
});
