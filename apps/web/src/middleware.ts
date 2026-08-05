// Note: `astro:middleware`'s `defineMiddleware` is a virtual module only resolvable
// inside Astro's build pipeline. This test suite runs under @cloudflare/vitest-pool-workers,
// which cannot resolve virtual modules. `defineMiddleware` is a pure type helper (no runtime
// behavior), so exporting `onRequest` directly is semantically identical to Astro's runtime.

// `'unsafe-inline'` on script-src is a defense-in-depth regression accepted only until
// Astro's experimental CSP integration stabilizes — see follow-up in progress ledger.
// The blast radius is limited by `object-src 'none'` (blocks <object>/<embed>/<applet>
// legacy injection vectors) and `base-uri 'self'` (blocks <base> tag hijacking that
// would otherwise reroute relative URLs to an attacker's origin).
const CSP = [
  "default-src 'self'",
  "img-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
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
