# @icon-collection/web

Cloudflare Pages で配信する検索 UI と icon delivery API。

## Runtime

- Astro 7 (SSR via `output: 'server'`) + Preact islands + Tailwind CSS v4
- `@astrojs/cloudflare` adapter が Astro server endpoints (`src/pages/**`) と middleware (`src/middleware.ts`) を単一 Worker (`dist/server/entry.mjs`) にバンドル
  - `GET /api/search`
  - `GET /icon/{collection}/{name}.svg`
  - `GET /icon/{collection}/{name}.mx`
- 静的アセットは `dist/client/` に配置され Workers Assets binding 経由で配信、動的ルートは Worker が処理
- Bindings: `DB` (D1, `icon-collection`) / `ICONS` (R2, `icon-collection`)、`env` は `import { env } from 'cloudflare:workers'` で参照

## Local development

1. `pnpm -F @icon-collection/web install`
2. `cp apps/web/.dev.vars.example apps/web/.dev.vars` (bindings を local emulate する場合)
3. `pnpm -F @icon-collection/web dev` — Astro dev server (`platformProxy` 有効で D1/R2 を miniflare emulate)
4. `pnpm -F @icon-collection/web test` — vitest-pool-workers による endpoint 統合テスト (Workers + browser の 2 プロジェクト対応)
5. `pnpm -F @icon-collection/web build` — `dist/{client,server}/` を生成
6. `cd apps/web/dist/server && pnpm dlx wrangler dev` — 生成された Worker + assets binding を local emulate

## Deploy

Cloudflare ダッシュボードの Git 連携で `master` push → auto deploy。

プロジェクト設定 (現行):
- Root directory: `apps/web`
- Build command: `npm run build && npx wrangler deploy`
- 動的ルートは Astro adapter が生成する `dist/server/entry.mjs` を Worker として、静的アセットは `dist/client/` を assets binding として deploy
- Bindings: `DB` (D1), `ICONS` (R2) を `wrangler.jsonc` に定義

## API contract

`GET /api/search?q=<string>&collection=<repeat>&license=<repeat>&limit=<1-200>&cursor=<opaque>`

Response 200 (JSON):

    { "hits": [{"collection":"mdi","name":"home","license":"Apache-2.0","width":24,"height":24}],
      "total": 123,
      "cursor": "eyJvZmZzZXQiOjYwfQ" }

## Cache policy

- `/icon/*` — `public, max-age=31536000, immutable`
- `/api/search` — `s-maxage=60, stale-while-revalidate=300`
- 全レスポンスに CSP / nosniff / referrer-policy

## Security

- SVG body は `<script>` / event handler / `<foreignObject>` を検出したら 500
- CSP `default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'`
