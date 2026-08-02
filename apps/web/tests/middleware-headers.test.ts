import { describe, expect, it } from 'vitest';
import { onRequest } from '../src/middleware.ts';

describe('middleware-headers', () => {
  it('adds CSP and X-Content-Type-Options headers to next response', async () => {
    const nextRes = new Response('ok');
    const res = await onRequest(null, async () => nextRes);
    expect(res.headers.get('content-security-policy')).toContain("default-src 'self'");
    expect(res.headers.get('content-security-policy')).toContain(
      "script-src 'self' 'unsafe-inline'",
    );
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    expect(await res.text()).toBe('ok');
  });
});
