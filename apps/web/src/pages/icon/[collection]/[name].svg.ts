import type { APIRoute } from 'astro';
import { hashSha256, isUnsafeSvg, loadCollection } from '../../../lib/iconify-cache.ts';

// `lib.dom.d.ts`'s `CacheStorage` (pulled in for browser-side Astro/Preact code
// elsewhere in this app) shadows the Workers runtime's `caches` global, which
// additionally exposes `.default`. The DOM and Workers `Request`/`Response`
// types are otherwise interchangeable for this call shape, so re-assert the
// global against a minimal local shape rather than importing the
// Workers-only `Cache`/`CacheStorage` types (which pull in Workers-only
// `Request`/`Response` and conflict with the DOM ones used everywhere else).
type WorkerCacheStorage = {
  readonly default: {
    match: (request: Request) => Promise<Response | undefined>;
    put: (request: Request, response: Response) => Promise<void>;
  };
};
const workerCaches = caches as unknown as WorkerCacheStorage;

export const prerender = false;

export const GET: APIRoute = async ({ request, locals, params }) => {
  const env = locals.runtime.env;
  const cache = workerCaches.default;
  const cached = await cache.match(request);
  if (cached) return cached;

  const collection = params.collection ?? '';
  const name = params.name ?? '';
  const json = await loadCollection(env, collection);
  if (!json) return new Response('not found', { status: 404 });
  const icon = json.icons[name];
  if (!icon || typeof icon.body !== 'string') return new Response('not found', { status: 404 });

  if (isUnsafeSvg(icon.body)) return new Response('unsafe content', { status: 500 });

  const width = icon.width ?? json.width ?? 24;
  const height = icon.height ?? json.height ?? 24;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">${icon.body}</svg>`;
  const etag = `"sha256:${await hashSha256(svg)}"`;
  const res = new Response(svg, {
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      'cache-control': 'public, max-age=31536000, immutable',
      etag,
    },
  });
  await cache.put(request, res.clone());
  return res;
};
