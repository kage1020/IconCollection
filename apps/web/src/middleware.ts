// Note: `astro:middleware`'s `defineMiddleware` is a virtual module only resolvable
// inside Astro's build pipeline. This test suite runs under @cloudflare/vitest-pool-workers,
// which cannot resolve virtual modules. `defineMiddleware` is a pure type helper (no runtime
// behavior), so exporting `onRequest` directly is semantically identical to Astro's runtime.

// `'unsafe-inline'` on script-src: Astro SSR injects inline scripts for hydration
// bootstrap and island rehydration. Without allowing inline scripts the page fails
// to render. Migrating to a nonce-based CSP requires Astro's experimental CSP
// integration (see docs) — deferred until it stabilizes.
const CSP = [
  "default-src 'self'",
  "img-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
].join('; ');

export const onRequest = async (
  _context: unknown,
  next: () => Promise<Response>,
): Promise<Response> => {
  const res = await next();
  const headers = new Headers(res.headers);
  headers.set('content-security-policy', CSP);
  headers.set('x-content-type-options', 'nosniff');
  headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
};
