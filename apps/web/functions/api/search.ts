import type { IconHit, SearchResponse } from '@icon-collection/core';
import { buildFtsQuery, expandQuery, normalizeQuery } from '@icon-collection/core';
import { loadDictionary } from '@icon-collection/synonyms';

const DICTS = [loadDictionary('en'), loadDictionary('ja')] as const;

type Env = {
  DB: D1Database;
};

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 60;

const CACHE_HEADERS = {
  'cache-control': 's-maxage=60, stale-while-revalidate=300',
};

const decodeCursor = (raw: string | null): number => {
  if (!raw) return 0;
  try {
    const base64 = raw.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const parsed = JSON.parse(atob(padded)) as { offset: number };
    return Number.isFinite(parsed.offset) && parsed.offset >= 0 ? parsed.offset : 0;
  } catch {
    return 0;
  }
};

const encodeCursor = (offset: number): string =>
  btoa(JSON.stringify({ offset })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const jsonError = (status: number, message: string): Response =>
  Response.json({ error: message }, { status });

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const q = url.searchParams.get('q');
  if (!q || normalizeQuery(q).length === 0) return jsonError(400, 'q is required');

  const limitRaw = url.searchParams.get('limit');
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : DEFAULT_LIMIT;
  if (!Number.isFinite(limit) || limit <= 0 || limit > MAX_LIMIT) {
    return jsonError(400, 'limit must be 1..200');
  }

  const offset = decodeCursor(url.searchParams.get('cursor'));
  const collections = url.searchParams.getAll('collection');
  const licenses = url.searchParams.getAll('license');

  const terms = expandQuery(q, DICTS);
  const fts = buildFtsQuery(terms);
  if (fts.length === 0) {
    return Response.json({ hits: [], total: 0, cursor: null } satisfies SearchResponse, {
      headers: CACHE_HEADERS,
    });
  }

  const conds: string[] = ['icons_fts MATCH ?'];
  const params: unknown[] = [fts];
  if (collections.length > 0) {
    conds.push(`i.collection IN (${collections.map(() => '?').join(', ')})`);
    params.push(...collections);
  }
  if (licenses.length > 0) {
    conds.push(`i.license IN (${licenses.map(() => '?').join(', ')})`);
    params.push(...licenses);
  }
  const where = conds.join(' AND ');

  const countSql = `SELECT COUNT(*) AS n FROM icons i JOIN icons_fts f ON f.rowid = i.id WHERE ${where}`;
  const listSql = `SELECT i.collection, i.name, i.license FROM icons i JOIN icons_fts f ON f.rowid = i.id WHERE ${where} ORDER BY bm25(icons_fts) LIMIT ? OFFSET ?`;

  try {
    const countRow = await env.DB.prepare(countSql)
      .bind(...params)
      .first<{ n: number }>();
    const rowsRes = await env.DB.prepare(listSql)
      .bind(...params, limit, offset)
      .all<{ collection: string; name: string; license: string }>();
    const rows = rowsRes.results ?? [];
    const total = countRow?.n ?? 0;

    const usedCollections = Array.from(new Set(rows.map((r) => r.collection)));
    let dims = new Map<string, { w: number; h: number }>();
    if (usedCollections.length > 0) {
      const metaSql = `SELECT collection, default_width, default_height FROM collection_meta WHERE collection IN (${usedCollections.map(() => '?').join(', ')})`;
      const metaRes = await env.DB.prepare(metaSql)
        .bind(...usedCollections)
        .all<{ collection: string; default_width: number; default_height: number }>();
      dims = new Map(
        (metaRes.results ?? []).map((r) => [
          r.collection,
          { w: r.default_width, h: r.default_height },
        ]),
      );
    }

    const hits: IconHit[] = rows.map((r) => {
      const d = dims.get(r.collection) ?? { w: 24, h: 24 };
      return {
        collection: r.collection,
        name: r.name,
        license: r.license,
        width: d.w,
        height: d.h,
      };
    });

    const nextOffset = offset + hits.length;
    const cursor = nextOffset < total ? encodeCursor(nextOffset) : null;

    return Response.json({ hits, total, cursor } satisfies SearchResponse, {
      headers: CACHE_HEADERS,
    });
  } catch (e) {
    console.error(
      JSON.stringify({ path: '/api/search', error: e instanceof Error ? e.message : String(e) }),
    );
    return jsonError(500, 'internal');
  }
};
