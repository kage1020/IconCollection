# @icon-collection/web

Cloudflare Pages で配信する検索 UI と icon delivery API。

## Runtime

- Astro 5 (SSG) + Preact islands + Tailwind CSS v4
- Cloudflare Pages Functions (`functions/**`)
  - `GET /api/search`
  - `GET /icon/{collection}/{name}.svg`
  - `GET /icon/{collection}/{name}.mx`
- Bindings: `DB` (D1, `icon-collection`) / `ICONS` (R2, `icon-collection`)

## Local development

1. `pnpm -F @icon-collection/web install`
2. `cp apps/web/.dev.vars.example apps/web/.dev.vars` (未設定でも SSG は動く)
3. `pnpm -F @icon-collection/web dev` — Astro dev server (Functions は fetch mock 未接続、API テストは `pnpm test` を使用)
4. `pnpm -F @icon-collection/web test` — vitest-pool-workers による Functions 統合テスト（Workers + browser の 2 プロジェクト対応）
5. `pnpm -F @icon-collection/web build` — `dist/` を生成
6. `pnpm -F @icon-collection/web preview` — `wrangler pages dev ./dist` で bindings 込みプレビュー

## Deploy

Cloudflare Pages の Git 連携 (`master` push → auto deploy)。

Pages プロジェクト設定:
- Build command: `pnpm -F @icon-collection/web build`
- Output directory: `apps/web/dist` は Cloudflare Pages ダッシュボード（Git 連携デプロイ）で設定
- Root directory: `/` (monorepo root)
- Environment variables: なし (bindings 経由)
- Bindings: `DB` (D1), `ICONS` (R2) をダッシュボードから登録

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
