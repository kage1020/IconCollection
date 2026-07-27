# Plan C: Web + API 設計仕様

**Status:** Draft
**Date:** 2026-07-28
**Depends on:** Plan A (monorepo + packages/{core,synonyms,ui}), Plan B (tools/ingest → R2 + D1)

## 目的

新しい検索 UI と SVG/mxlibrary 配信 API を、Cloudflare Pages + Pages Functions 上で公開する。既存の `packages/core` (`ApiClient`, `expandQuery`, `buildFtsQuery`) と `packages/ui` (Preact コンポーネント + hooks) を消費側として利用し、サーバ側で D1 FTS5 検索と R2 からの SVG 配信 / mxlibrary 変換を行う。あわせて Plan A/B の deferred items を解消する。

## 非目的

- 認証・API rate limit 導入 (public read-only、Cloudflare の DDoS/WAF 標準防御に委ねる)
- VSCode 拡張 (Plan D で扱う)
- 旧配信経路の停止 (Plan E で扱う)
- semantic / ベクトル検索の実装 (synonym expansion のみで担保)

## アーキテクチャ

```
Browser (Preact islands)
   │ /api/search?q=…       (JSON)
   │ /icon/{collection}/{name}.svg   (image/svg+xml)
   │ /icon/{collection}/{name}.mx    (application/xml, mxlibrary)
   ▼
Cloudflare Pages
   ├─ Static: Astro build (index.html + hydrated islands + Tailwind CSS)
   └─ Pages Functions (`functions/**`)
        ├─ api/search.ts   → D1 FTS5 query + expandQuery
        ├─ icon/[collection]/[name].svg.ts  → R2 GET + Cache API
        └─ icon/[collection]/[name].mx.ts   → R2 GET + svgToMxLibrary + Cache API
   Bindings:
       DB      : D1  (icon-collection)
       ICONS   : R2  (icon-collection)
       CACHE   : (Workers) Cache API (default cache)
```

- **Static shell**: Astro が SSG で `index.html` を生成し、Preact island として `packages/ui` の `SearchBox` / `FilterBar` / `IconGrid` / `IconCell` / `CopyMenu` を hydration。island 間の状態は `packages/ui` の `useSearch` + Host コンテキスト経由で共有する。
- **API endpoints**: すべて Pages Functions (`functions/**`) で単一の Worker runtime、追加パッケージ不要。
- **Cache**: `/icon/…` は `Cache-Control: public, max-age=31536000, immutable` を返し、Workers Cache API + Cloudflare CDN に載せる。API `search` は `s-maxage=60, stale-while-revalidate=300` を付ける (D1 の書き込みは週次バッチのため短命キャッシュで十分)。

## Global Constraints (プロジェクト全体で維持)

- Node 22 LTS / pnpm 9 / TypeScript strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `allowImportingTsExtensions`)
- Bundler: Astro (Vite ベース) / Test: Vitest 4 / Lint: Biome 2
- 依存バージョンは CLI (`pnpm add`) 経由でインストール、`package.json` にハードコードしない
- linter-ignore ディレクティブ禁止 (代わりに設計で解消)
- Iconify JSON の canonical width/height はコレクション単位で共通 → **`collection_meta` に持たせて `icons` 行は肥大化させない**
- 商用配信物なので secret ログ出力禁止、環境変数は Pages の "Environment variables" (encrypted) に登録
- `IconHit.width` / `IconHit.height` は API レスポンス上は必須のまま維持し、サーバ側で `collection_meta` から join または in-memory dict で埋める

## API 仕様

### GET `/api/search`

**Query params**
- `q` (required, non-empty after normalize) — 検索文字列
- `collection` (repeatable, optional) — 絞り込みするコレクション ID
- `license` (repeatable, optional) — SPDX license id 絞り込み
- `limit` (optional, default 60, max 200)
- `cursor` (optional) — opaque; base64url({offset:number})

**Response 200** (`application/json`)
```json
{
  "hits": [{ "collection": "mdi", "name": "home", "license": "Apache-2.0", "width": 24, "height": 24 }],
  "total": 1234,
  "cursor": "eyJvZmZzZXQiOjYwfQ"
}
```
- `hits[].width` / `hits[].height` は `collection_meta` から埋める。missing の場合は default (24) を返し、`console.warn` ではなく `env.LOGGER` (structured log) に警告記録。
- `total` は FTS5 の `COUNT(*)` を LIMIT/OFFSET なしで別クエリ発行 (D1 v1 では JOIN でも 1 クエリで組むには rank subquery が必要 → 単純 2 クエリで良い)。
- FTS5 の `MATCH` を `expandQuery` の結果に対して発行、`OR` join。

**Response 400** — `q` 未指定 or 空、`limit` overflow。JSON `{ error: string }`。
**Response 500** — D1 例外。JSON `{ error: 'internal' }`。

### GET `/icon/{collection}/{name}.svg`

- R2 から `iconify/{collection}.json` を取得 (Workers メモリキャッシュ + Cache API で TTL 24h)。
- 該当 icon body を Iconify JSON から抽出し、`<svg viewBox="0 0 {w} {h}" xmlns="http://www.w3.org/2000/svg">{body}</svg>` に整形して返す。
- **セキュリティ**: `<script>` / event handler / `<foreignObject>` を含む出力を検出したら 500 (Iconify JSON は基本安全だが防御的に regex チェック)。
- Response headers: `content-type: image/svg+xml; charset=utf-8`, `cache-control: public, max-age=31536000, immutable`, `etag: "sha256:{hash8}"`.

### GET `/icon/{collection}/{name}.mx`

- `.svg` と同様に取得した SVG に `packages/ui/src/format.ts` の `svgToMxLibrary` を適用して返す。
- `content-type: application/xml; charset=utf-8`.

## Data model 変更 (Plan B #8)

`collection_meta` に `default_width` / `default_height` を追加:

```sql
ALTER TABLE collection_meta ADD COLUMN default_width INTEGER NOT NULL DEFAULT 24;
ALTER TABLE collection_meta ADD COLUMN default_height INTEGER NOT NULL DEFAULT 24;
```

- 既存 schema (`tools/ingest/src/schema.sql`) を更新し、`seed-meta.ts` は Iconify JSON の `width` / `height` (fallback 24) を書き込む。
- API 側は `SELECT default_width, default_height FROM collection_meta WHERE collection IN (…)` を search 実行時に 1 回呼んで in-memory map を作り、`hits` に write する。

## Plan A/B deferred items の解消

### 1. `ApiClient` を `HostContext` に注入 (Plan A #3)

- `packages/ui/src/host.tsx` の `Host` 型に `apiClient: ApiClient` を追加、`apiBaseUrl` は残す (VSCode 拡張ではリクエスト経路が違うため両方持たせる)。
- `useCopy` / `useSearch` / `IconCell` 内部の `createApiClient({ baseUrl: host.apiBaseUrl })` を削除し、`host.apiClient` を使う。
- Web 側 HostProvider で `createApiClient({ baseUrl })` を 1 度だけ生成し提供、VSCode 拡張 (Plan D) では独自 `ApiClient` 実装を差し込めるように。

### 2. `svgCache` のスコープ化 (Plan A #2)

- `IconCell` モジュールトップの `svgCache = new Map()` を削除し、`packages/ui/src/svg-cache.ts` を作成:
  - `createSvgCache(): SvgCache` factory (`{ get, set, has }` + `size`)
  - `HostProvider` は `svgCache: SvgCache` も注入
  - `IconCell` は `host.svgCache` を参照
- Web 側は provider マウント時に 1 度生成 (page reload で自然にクリアされる)。テストは `createSvgCache()` を各テストで作れば isolated になる。

### 3. `useCopy` エラー surface (Plan A #1)

- `useCopy` の `try/catch` で `error` を捨てず、`host.showToast(\`Copy failed: \${message}\`)` に message を含める。
- 引数を `{ onError?: (e: Error) => void }` にする案は YAGNI: toast にエラー内容を出せば十分。将来 UI 差別化が要る時に追加。

### 4. `D1Client.batch` 原子化 (Plan B #4)

- Cloudflare D1 の `/query` エンドポイントは `sql: string` に `;` 区切りの複数 statement を渡すか、`sql: string[]` (プレビュー) を使うと単一トランザクションで実行される。
- 本 plan では `execute` を残しつつ `batchAtomic(statements: readonly { sql: string; params?: readonly unknown[] }[]): Promise<D1Result[]>` を追加し、内部で `POST /query` に `[{ sql, params }, ...]` の配列を渡す (D1 HTTP API の spec 上、`sql` が array の場合はサーバー側で 1 tx 化される)。
- 失敗時は全 statement を rollback とみなし、`D1Error` を throw。
- `seed-icons.ts` / `seed-synonyms.ts` の DELETE + INSERT を 1 回の `batchAtomic` にまとめ、partial-fail による "old rows 消えて new rows 入っていない" 状態を防ぐ。
- ただし D1 の 100 bind-param 上限は **1 statement あたり** なので、batchAtomic 内の各 INSERT はこれまで通り 10-row / 20-row バッチを維持。

### 5. `schema.ts` の SQL split 汎用化 (Plan B #7)

- 現状 `/;\s*(?=CREATE|DROP|ALTER|BEGIN|END)/i` は DDL 決め打ち。将来 seed も再利用したいので:
  - `SCHEMA_STATEMENTS` は "DDL only" と JSDoc で明記
  - split ロジックを `packages/core/src/sql.ts` に `splitStatements(sql: string, opts: { keywords: readonly string[] }): readonly string[]` として抽出
  - keywords を渡す形で ingest / (将来 Pages Functions) から再利用

## セキュリティ / 運用

- **Secrets**: `CLOUDFLARE_ACCOUNT_ID` / `D1_DATABASE_ID` / R2 credentials は Cloudflare Pages の env に、ローカル開発は `.dev.vars` (git ignore)。
- **CSP**: Pages 配信 HTML に `Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'` を返す (Tailwind runtime なし前提、`unsafe-inline` は Astro inline critical CSS 用)。
- **CORS**: 同一オリジン想定なので `Access-Control-Allow-Origin: *` は付けない。VSCode 拡張は Plan D で拡張側から fetch するので、CORS 追加は Plan D で判断。
- **観測性**: Pages Functions の `console.log` は自動で Logpush 対応、追加のロガーは不要。エラー時のみ `console.error` で `{ path, status, message }` の JSON を出す。

## テスト戦略

- **サーバー (Pages Functions)**: `@cloudflare/vitest-pool-workers` を導入し、`env.DB` / `env.ICONS` を miniflare で mock。Iconify JSON fixture (`__fixtures__/mdi-mini.json` 等 Plan B 由来) をロードして統合テスト。
- **クライアント (Astro island)**: `@testing-library/preact` で SearchBox → useSearch → IconGrid のインタラクションを smoke test。SSR HTML は Astro のビルドで検証 (`astro build` の exit code をテスト)。
- **e2e スモーク**: 別 plan / follow-up。今 plan では `functions/` の integration test を最低ラインとする。

## Deliverables

- `apps/web` (Astro + Preact + Tailwind v4 + Pages Functions)
- `packages/core/src/sql.ts` (`splitStatements`)
- `packages/ui/src/host.tsx` (extended `Host` type)
- `packages/ui/src/svg-cache.ts` (new)
- `packages/ui/src/hooks/useCopy.ts` / `useSearch.ts` / `IconCell.tsx` の書き換え
- `tools/ingest/src/d1.ts` (`batchAtomic`)
- `tools/ingest/src/schema.sql` (collection_meta 拡張)
- `tools/ingest/src/seed-meta.ts` (default_width/height 書き込み)
- Cloudflare Pages 用の `wrangler.toml` (bindings 宣言, git 連携で使用)
- `apps/web/README.md` (env / bindings / deploy)

## Open Questions

なし (deferred items は上記で解消方針を確定)。
