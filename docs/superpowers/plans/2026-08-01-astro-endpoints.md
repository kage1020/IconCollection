# Astro Server Endpoints Migration (Plan F — Hotfix)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]` for tracking.

**Goal:** 本番 `/api/search` etc. が 404 になっている状態を修復。`@astrojs/cloudflare@14.x` は `output: 'static'` + `functions/` を deploy しないため、Astro server endpoints (`src/pages/**`) に移行して adapter に Worker を生成させる。

**Root Cause:** `npx wrangler deploy` (Workers Assets モデル) は `main` フィールドを要求するが、`output: 'static'` の Astro build は生成しない。結果、静的アセットのみ deploy され動的ルートは全て 404。

**Solution:** `output: 'server'` に切替 + Pages Functions (`apps/web/functions/**`) を Astro endpoints (`apps/web/src/pages/**`) と Astro middleware (`apps/web/src/middleware.ts`) に移行。adapter が自動で `main` を生成。

## Global Constraints

- Node 22 / pnpm 9 / TypeScript strict + 全フラグ
- Astro 7 / Vitest 4 / Biome 2
- NO linter-ignore
- 挙動 (レスポンス shape / cache-control / CSP) を維持
- ライブラリ差異 (`PagesFunction` API → Astro `APIContext` API) は adapter レイヤで吸収
- Env アクセスは `Astro.locals.runtime.env` 経由 (Astro Cloudflare adapter の規約)
- Tests は既存の behavioral assertions を可能な限り維持

---

### Task 1: `output: 'server'` 切替 + adapter 動作確認

**Files:**
- Modify: `apps/web/astro.config.mjs`
- Modify: `apps/web/wrangler.jsonc` — pending observability 変更を同 commit に含める

**Interfaces:** none

- [ ] **Step 1: astro.config.mjs 変更**

```javascript
// output: 'static' → 'server'
export default defineConfig({
  output: 'server',
  adapter: cloudflare({ platformProxy: { enabled: true } }),
  integrations: [preact()],
  vite: { plugins: [tailwindcss()] },
});
```

`mode: 'directory'` は v14+ で無視されるため削除。代わりに `platformProxy.enabled: true` を有効化 (`astro dev` で Cloudflare bindings を local emulate)。

- [ ] **Step 2: build 実行**

```bash
pnpm -F @icon-collection/web build
```

Expected:
- `apps/web/dist/_worker.js/` ディレクトリ (adapter 生成 Worker) が存在
- `dist/_worker.js/index.js` に main entrypoint
- `dist/client/wrangler.json` (もしくは `dist/wrangler.json`) の中身に `main` フィールドが入る (以前の `assets` only ではなくなる)

- [ ] **Step 3: 生成された wrangler.json / dist 構造を確認**

```bash
find apps/web/dist -maxdepth 3 -type f | head -30
cat apps/web/dist/wrangler.json 2>/dev/null || cat apps/web/dist/client/wrangler.json 2>/dev/null
```

`main` の値と `assets.directory` の値をレポートに書き留める。

- [ ] **Step 4: observability 設定を wrangler.jsonc に統合 (pending 変更を含む)**

現在 `git status` で `M apps/web/wrangler.jsonc` として残っている observability block を保持したまま commit する。

- [ ] **Step 5: commit**

```bash
git add apps/web/astro.config.mjs apps/web/wrangler.jsonc
git commit -m "build(web): switch Astro to server output and enable observability"
```

Tests / lint / typecheck はまだ 100% 通らないかもしれない (`functions/` が旧のまま) — Task 2+ で修正される。verify は build 成功のみ。

---

### Task 2: `/api/search` を Astro endpoint に移行

**Files:**
- Create: `apps/web/src/pages/api/search.ts` (Astro endpoint 形式)
- Delete: `apps/web/functions/api/search.ts`
- Modify: `apps/web/tests/api-search.test.ts` — 呼び出し方を Astro endpoint 経由に変更

**Interfaces:**
- Astro API endpoint: `export const GET: APIRoute = async ({ request, locals, params }) => { ... }`
- Env アクセス: `const env = locals.runtime.env as { DB: D1Database }` (adapter は `Astro.locals.runtime` に env を注入)

- [ ] **Step 1: Astro endpoint 版を作成**

`functions/api/search.ts` のロジックをそのまま移植 (URL parsing, FTS query, D1 access, cache header)。差分:

```typescript
// apps/web/src/pages/api/search.ts
import type { APIRoute } from 'astro';
import { buildFtsQuery, expandQuery, normalizeQuery } from '@icon-collection/core';
import type { IconHit, SearchResponse } from '@icon-collection/core';
import { loadDictionary } from '@icon-collection/synonyms';

const DICTS = [loadDictionary('en'), loadDictionary('ja')] as const;
const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 60;
const CACHE_HEADERS = { 'cache-control': 's-maxage=60, stale-while-revalidate=300' };

// decodeCursor / encodeCursor は既存 functions/api/search.ts から移植 (padding 復元込み)

const jsonError = (status: number, message: string): Response =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json' },
  });

export const prerender = false;

export const GET: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env as { DB: D1Database };
  // 以下 functions/api/search.ts の onRequest 本体をそのまま (ctx.env → env に置換)
  // …
};
```

`locals.runtime.env` の型は Astro Cloudflare adapter が `App.Locals.runtime` として提供。`env.d.ts` に:

```typescript
declare namespace App {
  interface Locals {
    runtime: {
      env: Cloudflare.Env;
    };
  }
}
```

を追加 (既存 `env.d.ts` に append)。

- [ ] **Step 2: 旧 `functions/api/search.ts` を削除**

```bash
git rm apps/web/functions/api/search.ts
```

- [ ] **Step 3: tests を Astro endpoint 呼び出しに切替**

vitest-pool-workers の Workers ランタイム下で Astro endpoint を直接呼ぶには、以下 2 パターン:
- (a) Astro Container API を使う (公式サポート、`experimental_AstroContainer`)
- (b) endpoint module を dynamic import して `GET(ctx)` を直接呼ぶ (ctx を自作)

**推奨: (b)**。Container API は SSR 用で server-render context が要る。API endpoint は plain function として call 可能。

```typescript
// apps/web/tests/api-search.test.ts (書き直し)
import { env } from 'cloudflare:workers';
import { describe, expect, it, beforeEach } from 'vitest';
import { seedTestDb } from './setup/miniflare.ts';
import { GET } from '../src/pages/api/search.ts';

const call = async (url: string): Promise<Response> => {
  const request = new Request(`https://x${url}`);
  const ctx = {
    request,
    locals: { runtime: { env } },
    // 他 required fields は Astro API endpoint 呼び出し上不要 (params, cookies, redirect 等は非使用)
  } as unknown as Parameters<typeof GET>[0];
  return GET(ctx);
};

beforeEach(() => seedTestDb());

// 既存の 7 test cases はそのまま (assertion 変更なし)
```

- [ ] **Step 4: full workspace test**

Run: `pnpm -F @icon-collection/web test`
Expected: 全既存テスト green + api-search.test.ts の 7 tests pass。

- [ ] **Step 5: typecheck / lint clean**

- [ ] **Step 6: commit**

```bash
git add apps/web
git commit -m "feat(web): move /api/search to Astro server endpoint"
```

---

### Task 3: `/icon/{c}/{n}.svg` と `.mx` を Astro endpoints に移行

**Files:**
- Create: `apps/web/src/pages/icon/[collection]/[name].svg.ts`
- Create: `apps/web/src/pages/icon/[collection]/[name].mx.ts`
- Delete: `apps/web/functions/icon/[collection]/[name].svg.ts`
- Delete: `apps/web/functions/icon/[collection]/[name].mx.ts`
- Modify: `apps/web/tests/icon-svg.test.ts`
- Modify: `apps/web/tests/icon-mx.test.ts`

**Interfaces:**
- Astro dynamic route: `params.collection`, `params.name` を `APIContext.params` 経由で取得
- Cache API (`caches.default`) は Workers runtime で利用可 (Astro Cloudflare adapter 経由でも)

- [ ] **Step 1: `.svg` endpoint 移植**

```typescript
// apps/web/src/pages/icon/[collection]/[name].svg.ts
import type { APIRoute } from 'astro';
import { hashSha256, isUnsafeSvg, loadCollection } from '../../../lib/iconify-cache.ts';
// ↑ lib/iconify-cache.ts は既に apps/web/src/lib/ にある

export const prerender = false;

export const GET: APIRoute = async ({ request, locals, params }) => {
  const env = locals.runtime.env as { ICONS: R2Bucket };
  const collection = params.collection ?? '';
  const name = params.name ?? '';
  // 以下 functions/icon/[c]/[n].svg.ts の onRequest 本体 (env / params reference 調整)
};
```

Cache API は Astro adapter が provide、`caches.default` に到達できる (念のため `as unknown as WorkerCacheStorage` cast pattern を維持)。

- [ ] **Step 2: `.mx` endpoint 移植**

同様に `functions/icon/[c]/[n].mx.ts` を `src/pages/icon/[collection]/[name].mx.ts` に。`svgToMxLibrary` import path は変わらず (`@icon-collection/ui`)。

- [ ] **Step 3: 旧 functions を削除**

```bash
git rm apps/web/functions/icon/[collection]/[name].svg.ts
git rm apps/web/functions/icon/[collection]/[name].mx.ts
rmdir apps/web/functions/icon/[collection] apps/web/functions/icon 2>/dev/null || true
```

- [ ] **Step 4: tests を rewrite (Task 2 と同じパターン)**

- [ ] **Step 5: test / typecheck / lint**

Run: `pnpm -F @icon-collection/web test && pnpm typecheck && pnpm lint`
Expected: 全 green (18 tests から icon 系 5 tests → 同数維持のはず)

- [ ] **Step 6: commit**

```bash
git add apps/web
git commit -m "feat(web): move /icon/{c}/{n}.{svg,mx} to Astro server endpoints"
```

---

### Task 4: `_middleware.ts` → `src/middleware.ts` に移行

**Files:**
- Create: `apps/web/src/middleware.ts`
- Delete: `apps/web/functions/_middleware.ts`
- Modify: `apps/web/tests/middleware-headers.test.ts`

**Interfaces:**
- Astro middleware: `export const onRequest = defineMiddleware(async (context, next) => { ... })`
- 全レスポンスに 3 security headers を注入 (CSP + nosniff + Referrer-Policy)

- [ ] **Step 1: middleware 移植**

```typescript
// apps/web/src/middleware.ts
import { defineMiddleware } from 'astro:middleware';

const CSP = [
  "default-src 'self'",
  "img-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
].join('; ');

export const onRequest = defineMiddleware(async (_context, next) => {
  const res = await next();
  const headers = new Headers(res.headers);
  headers.set('content-security-policy', CSP);
  headers.set('x-content-type-options', 'nosniff');
  headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
});
```

- [ ] **Step 2: 旧 `_middleware.ts` を削除**

```bash
git rm apps/web/functions/_middleware.ts
```

- [ ] **Step 3: `functions/` ディレクトリを完全削除確認**

```bash
find apps/web/functions -type f 2>&1
```

Expected: no files. 空 dir なら `rm -r apps/web/functions`。

- [ ] **Step 4: tests を Astro middleware 呼び出しに書き換え**

```typescript
// apps/web/tests/middleware-headers.test.ts (書き直し)
import { describe, expect, it } from 'vitest';
import { onRequest } from '../src/middleware.ts';

it('adds CSP and X-Content-Type-Options headers to next response', async () => {
  const nextRes = new Response('ok');
  const res = await onRequest(
    { request: new Request('https://x/'), locals: {} as never, params: {} } as never,
    async () => nextRes,
  );
  expect(res.headers.get('content-security-policy')).toContain("default-src 'self'");
  expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
  expect(await res.text()).toBe('ok');
});
```

- [ ] **Step 5: test / typecheck / lint clean**

- [ ] **Step 6: commit**

```bash
git add apps/web
git commit -m "feat(web): move security headers to Astro middleware"
```

---

### Task 5: E2E 検証 + PR

**Files:** none (verification only)

- [ ] **Step 1: 完全 build → wrangler.jsonc の main を確認**

```bash
pnpm -F @icon-collection/web build
cat apps/web/dist/wrangler.json 2>/dev/null || cat apps/web/dist/client/wrangler.json 2>/dev/null
```

期待: `"main": "..."` フィールドが存在し、Worker script のパスを指す。

- [ ] **Step 2: `wrangler pages dev` で local emulate**

```bash
cd apps/web
pnpm dlx wrangler pages dev ./dist/client --compatibility-date=2026-07-01
```

別 shell から:
```bash
curl -sv http://localhost:8788/api/search?q=home | head -20
curl -sv http://localhost:8788/icon/mdi/home.svg | head -10
curl -sv http://localhost:8788/mdi/home.svg | head -5   # _redirects 経由で 301
```

Expected: 200/301 応答、404 なし。

- [ ] **Step 3: wrangler dry-run で deploy 内容を確認**

```bash
cd apps/web
pnpm dlx wrangler deploy --dry-run --outdir ./dist-check 2>&1 | tail -20
```

Expected: `main` script + assets binding が deploy 対象になる旨表示。

- [ ] **Step 4: 全 workspace 最終確認**

```bash
cd ../..
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
```

Expected: 全 green。

- [ ] **Step 5: branch push + PR**

```bash
git push -u origin feat/astro-endpoints
gh pr create --title "fix(web): migrate Pages Functions to Astro server endpoints" --body "$(cat <<'EOF'
## Summary
**Hotfix**: 本番 `/api/search` などの動的ルートが 404 になっていた問題を修復。

## Root Cause
`@astrojs/cloudflare@14.x` は `output: 'static'` + `mode: 'directory'` を Workers Assets モデルに切り替え済み。`apps/web/functions/**` は deploy 対象に含まれず dead code 化していた (`dist/client/wrangler.json` の `main` フィールド不在 → Worker script なし → 全動的ルート 404)。

## Fix
- `output: 'server'` に切替、`@astrojs/cloudflare` adapter が Worker を自動生成
- `apps/web/functions/**` を Astro endpoints (`src/pages/api/*.ts`, `src/pages/icon/[c]/[n].{svg,mx}.ts`) に移行
- `_middleware.ts` を Astro middleware (`src/middleware.ts`) に移行
- Tests を Astro endpoint 呼び出しに rewrite (behavioral assertions は維持)
- `wrangler.jsonc` に observability block を追加 (pending 変更を統合)

## Test plan
- [ ] pnpm lint / typecheck / test — 全 green
- [ ] pnpm -F @icon-collection/web build → dist/wrangler.json に main フィールド出現
- [ ] wrangler pages dev で /api/search と /icon/mdi/home.svg が 200 を返す
- [ ] 本番デプロイ後 curl で確認

## Related
- Plan C: Pages Functions 実装 (この plan で置換)
- Plan D/E: cleanup 継続
EOF
)"
```

- [ ] **Step 6: PR URL 返却**

---

## Follow-up (post-merge)

- `functions/` 参照の完全一掃確認 (grep でリークがないか)
- adapter のバージョン差異による regression 監視 (Astro 8 系リリース時に platformProxy API が変わる可能性)
