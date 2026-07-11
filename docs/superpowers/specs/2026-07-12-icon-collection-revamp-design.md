# IconCollection 刷新 設計ドキュメント

- 作成日: 2026-07-12
- 対象リポジトリ: `kage1020/IconCollection`
- 対象範囲: `parsers/` 刷新、VSCode 拡張刷新、Web 検索サイト新設（SVG 配信兼）

## 1. 背景と目的

現行の IconCollection は次の構成で稼働している。

- `parsers/*.js` が `react-icons` と `@iconify/json` から SVG を「事前展開」してファイル群として書き出す
- 書き出した SVG は `icons.kage1020.com` から配信
- 検索は Algolia の共有インデックス (`icons`) を利用
- VSCode 拡張はクエリごとに Algolia 検索 → 各 SVG を fetch してクリップボードにコピー

長期メンテナンスが止まっており、次の課題を刷新で解消する。

- 検索・表示のレスポンスが遅い（クエリごとに全ヒットを fetch）
- パーサでの SVG 事前展開により膨大なファイル入出力と更新運用コストが発生
- Algolia 依存によるベンダーロックと無料枠制約
- 更新フローが手動で、Iconify / react-icons の新版追従が滞る
- 同義語・多言語（例: 「カート」→ `cart`）に反応しない

## 2. スコープ

刷新対象:

- `parsers/` の役割変更（SVG 事前展開の廃止、メタ集約と R2/D1 seed へ）
- VSCode 拡張の UI と実装刷新
- Web 検索サイト新設（`icons.kage1020.com` のインフラに統合）
- CI/CD と自動更新パイプライン

スコープ外:

- 色変更・サイズ変更・スタイル変換 UI（需要なし判定）
- Embedding ベースのベクトル検索・LLM リランク（同義語・i18n 拡張レベルで十分）
- draw.io 以外のダイアグラム形式サポート

## 3. 意思決定サマリー

| 項目 | 決定 |
| --- | --- |
| ホスティング | Cloudflare Pages / Workers / R2 / D1 |
| Web フレームワーク | Astro（Vite）+ Preact islands |
| VSCode 拡張バンドラ | tsup（既存 webpack を置換） |
| モノレポ | pnpm workspace、Biome、Vitest |
| 検索基盤 | D1 SQLite の FTS5（BM25）＋ 同義語辞書 |
| セマンティック度 | 同義語・i18n 拡張レベル |
| SVG 配信 | Iconify JSON を原本に置き、Worker が `@iconify/utils` で組み立て |
| アイコンソース | 現状維持（react-icons + Iconify 全コレクション） |
| UI 共通化 | `packages/ui` を Web と拡張の双方で使用 |
| Web デプロイ | Cloudflare Pages の Git 連携（Actions からは実行しない） |
| 拡張公開 | GitHub Actions + Azure OIDC（`vsce publish --azure-credential`） |

## 4. 全体アーキテクチャ

```
GitHub Actions (weekly cron / manual dispatch)
  ├─ react-icons / @iconify/json の最新版を検知
  ├─ 差分のあるコレクションのみメタ集約
  ├─ R2 に原本 JSON を sync
  └─ D1 に FTS5 index を rebuild

Cloudflare Pages: icons.kage1020.com
  ├─ Astro SSG: トップ / コレクション一覧 / About
  ├─ Pages Functions (Workers):
  │   ├─ GET /api/search
  │   ├─ GET /icon/:collection/:name.svg
  │   └─ GET /icon/:collection/:name.mx
  └─ Bindings: D1 (search), R2 (icons)

VSCode 拡張 (WebView)  ─┐
                       ├─→ 上記 API を共通で利用
Web 検索サイト (island)─┘
```

## 5. リポジトリ構成（Monorepo）

```
IconCollection/
├─ pnpm-workspace.yaml
├─ biome.json
├─ tsconfig.base.json
├─ apps/
│   ├─ web/                    # Astro (Cloudflare Pages)
│   │   ├─ src/pages/          # SSG ページ
│   │   ├─ src/functions/      # Pages Functions
│   │   ├─ src/db/             # D1 schema, queries
│   │   ├─ src/lib/svg.ts      # Iconify から SVG 組み立て
│   │   └─ wrangler.toml
│   └─ extension/              # VSCode 拡張 (tsup)
│       ├─ src/extension.ts
│       └─ src/webview/        # Preact エントリ (packages/ui を使う)
├─ packages/
│   ├─ ui/                     # Preact 共通コンポーネント
│   ├─ core/                   # 型・API クライアント・シノニム展開
│   └─ synonyms/               # 同義語/i18n 辞書 (JSON)
├─ tools/
│   └─ ingest/                 # 旧 parsers/ を刷新した ingest スクリプト
│       ├─ collect.ts
│       ├─ sync-r2.ts
│       └─ seed-d1.ts
└─ docs/superpowers/specs/
```

- 旧 `parsers/` `extension/` は移行完了までは残置し、フェーズ 5 で削除する
- Package manager は pnpm。Linter/Formatter は Biome。Bundler は Web が Astro（Vite）、拡張が tsup。Test は Vitest

## 6. データ設計

### 6-1. R2 レイアウト

```
r2://icon-collection/
├─ meta/
│   ├─ version.json          # 各コレクションの現在バージョン
│   └─ manifest.json         # 検索対象コレクション一覧 + ライセンス
├─ iconify/
│   └─ {collection}.json     # @iconify/json 原本
└─ react-icons/
    └─ {collection}.json     # react-icons を IconifyJSON 形式へ正規化
```

- 個別 SVG は事前に書き出さない
- react-icons は ingest 時に `{ prefix, icons: { name: { body, width, height } } }` 形式へ正規化
- Worker は `@iconify/utils` の `iconToSVG` で SVG を組み立てて返す
- R2 の更新は sha256 で差分検知、変更のあった collection のみ put する

### 6-2. D1 スキーマ

```sql
CREATE TABLE icons (
  id         INTEGER PRIMARY KEY,
  collection TEXT    NOT NULL,
  name       TEXT    NOT NULL,
  license    TEXT    NOT NULL,
  categories TEXT,
  tags       TEXT,
  aliases    TEXT,
  updated_at INTEGER NOT NULL,
  UNIQUE(collection, name)
);
CREATE INDEX idx_icons_collection ON icons(collection);

CREATE VIRTUAL TABLE icons_fts USING fts5(
  name, aliases, tags, categories, collection UNINDEXED,
  content='icons', content_rowid='id',
  tokenize='unicode61 remove_diacritics 2'
);
-- クエリ時: bm25(icons_fts, 4.0, 3.0, 1.5, 1.0)

CREATE TABLE synonyms (
  term      TEXT NOT NULL,
  expansion TEXT NOT NULL,
  lang      TEXT NOT NULL,  -- ja, en
  weight    REAL NOT NULL DEFAULT 1.0,
  PRIMARY KEY(term, expansion, lang)
);

CREATE TABLE collection_meta (
  collection TEXT PRIMARY KEY,
  version    TEXT NOT NULL,
  license    TEXT NOT NULL,
  total      INTEGER NOT NULL,
  synced_at  INTEGER NOT NULL
);
```

- BM25 の重み配分は `name > aliases > tags > categories` を仕様として明示
- `synonyms` は `packages/synonyms/*.json` から seed する

### 6-3. API 契約

**`GET /api/search`**

```
Query:
  q            必須, 1..64 文字
  collection   任意, カンマ区切り
  license      任意, カンマ区切り
  limit        任意, default 60, max 200
  cursor       任意, ページング用

200 (application/json):
{
  "hits": [
    { "collection": "mdi", "name": "home", "license": "Apache-2.0",
      "width": 24, "height": 24 }
  ],
  "total": 1234,
  "cursor": "..."
}
```

**`GET /icon/:collection/:name.svg`**

- 200: `image/svg+xml; charset=utf-8`, `Cache-Control: public, max-age=31536000, immutable`
- 404: 見つからない場合

**`GET /icon/:collection/:name.mx`**

- draw.io mxlibrary 用の XML fragment を返す
- Content-Type: `application/xml`

`?color=` や `?size=` は今回は実装せず、型の余地だけ残す。

### 6-4. 検索フロー（サーバー側）

1. `q` を lowercase + trim + Unicode NFKC
2. `synonyms` から `q` の各語について `lang IN ('ja','en')` の expansion を取得
3. 元語＋展開語を OR 結合した FTS5 クエリを組み立て
4. `icons_fts MATCH ? ORDER BY bm25(icons_fts, 4.0, 3.0, 1.5, 1.0) LIMIT ?`
5. `collection` / `license` フィルタは `icons` テーブルとの JOIN で適用
6. hit は SVG 本体を含めずメタのみ返却。クライアントが遅延取得する

### 6-5. クライアント側の遅延取得

- 検索結果はメタのみ
- グリッド各セルは IntersectionObserver で `/icon/:collection/:name.svg` を fetch
- 取得済み SVG はメモリ Map と HTTP cache（immutable）で長期キャッシュ

## 7. UI 設計

### 7-1. `packages/ui`

Preact + Tailwind CSS。

```
packages/ui/src/
├─ SearchBox.tsx     # 入力欄 (debounce, IME confirm 対応)
├─ IconGrid.tsx      # 仮想スクロール(virtua) + IntersectionObserver
├─ IconCell.tsx      # 1 セル: SVG lazy fetch, hover アクション
├─ FilterBar.tsx     # collection / license フィルタ
├─ CopyMenu.tsx      # SVG / mxlibrary / JSX 切替コピー
├─ EmptyState.tsx
├─ hooks/
│   ├─ useSearch.ts  # /api/search を叩く SWR 相当
│   └─ useCopy.ts    # 環境ごとの clipboard 抽象
└─ host.ts           # ホスト差分注入用の Context
```

ホスト差分は `HostContext` で注入する。

```ts
type Host = {
  apiBaseUrl: string;
  copyText: (s: string) => Promise<void>;
  showToast: (m: string) => void;
  persistState: {
    get: (k: string) => Promise<string | null>;
    set: (k: string, v: string) => Promise<void>;
  };
};
```

### 7-2. 状態

- 検索クエリ・フィルタ・カーソルは Web では URL + localStorage、拡張では VSCode globalState（postMessage 経由）に永続化
- 検索結果は `useSearch` が SWR キャッシュ
- SVG 実体は `IconCell` がメモリキャッシュ

### 7-3. `apps/web`（Astro）

- ルートページは静的（ヒーロー、統計、ライセンス一覧）
- 検索 UI は `<SearchPage client:load />` の Preact island
- コレクション詳細 `/c/[collection]` は SSG

### 7-4. `apps/extension`（VSCode）

- 現状の HTML 直書きを破棄
- `webview/main.tsx`（Preact）を tsup で bundle
- `extension.ts` はバンドル済み JS を注入する薄い host
- postMessage で `copyText` / `showToast` / `persistState.get,set` のみ橋渡し
- 検索と SVG 取得は WebView から `https://icons.kage1020.com/api/*` を直接叩く（CSP に該当ドメインを許可）

### 7-5. コピー操作の 3 形式

- **SVG**: サーバーから受け取った SVG をそのままコピー
- **JSX**: SVG を Preact 互換に軽く変換（`class` → `className` など）してコピー
- **mxlibrary(diagram)**: `/icon/:collection/:name.mx` を fetch した結果を直接コピー

## 8. 自動化 / CI / CD

### 8-1. GitHub Actions

**`ci.yml`**（PR / push）

- Biome check、Vitest、Astro type-check、tsc
- Playwright スモーク: `/api/search?q=home` が 200、SVG が 1 個以上描画

**`ingest.yml`**（weekly cron + manual dispatch）

```
jobs:
  detect:
    - npm view @iconify/json version
    - npm view react-icons version
    - R2 meta/version.json と比較 → outputs.changed
  ingest:
    if: needs.detect.outputs.changed == 'true'
    - tsx tools/ingest/collect.ts
    - tsx tools/ingest/sync-r2.ts       # sha256 差分 put
    - tsx tools/ingest/seed-d1.ts       # collection 単位で 500 行バッチ
    - INSERT INTO icons_fts(icons_fts) VALUES('rebuild');
    - meta/version.json を R2 put
    - Slack/Discord Webhook 通知
```

**`publish-extension.yml`**（tag `ext-v*` push）

- Azure OIDC（`azure/login@v2`）で federation ログイン
- `vsce publish --azure-credential` で公開
- PAT は保持しない

シークレット: `CLOUDFLARE_API_TOKEN`（ingest 用）、`CLOUDFLARE_ACCOUNT_ID`、`R2_BUCKET`、`D1_DATABASE_ID`、`AZURE_CLIENT_ID`、`AZURE_TENANT_ID`。

Azure 側の事前準備:

- Azure AD にアプリ登録し、federated credential を GitHub リポジトリ + `ref:refs/tags/ext-v*` に対して発行
- Marketplace publisher `kage1020` にサービスプリンシパルを Owner/Contributor 追加

### 8-2. Web デプロイ

- Cloudflare Pages の Git 連携で `master` push を検知し自動デプロイ
- ダッシュボード側で `Root directory=apps/web`、`Build command=pnpm -F web build`、`Output=dist` を指定
- GitHub Actions からは `wrangler pages deploy` を実行しない

### 8-3. D1 seed の分割戦略

- collection 単位で `DELETE` → `INSERT` を 500 行ずつバッチ実行
- FTS5 再構築は最後に `INSERT INTO icons_fts(icons_fts) VALUES('rebuild');` を 1 度
- 途中失敗時は `collection_meta.synced_at` を更新しないため、次回リトライで再実行される

## 9. エラー処理 / キャッシュ / 監視

### 9-1. エラー処理

- `/api/search`: 空クエリ 400、`q` 長超過 400、D1 timeout 503 (`Retry-After: 2`)、その他 500
- `/icon/*.svg`: R2 miss 404、`@iconify/utils` parse 失敗 500、structured log 出力
- クライアントは 5xx を 1 回だけ backoff リトライ、それ以外は `EmptyState` の error variant を表示

### 9-2. CSP（VSCode 拡張 WebView）

```
default-src 'none';
connect-src https://icons.kage1020.com;
img-src data: https://icons.kage1020.com;
script-src 'nonce-...';
style-src 'unsafe-inline' vscode-resource:;
```

### 9-3. キャッシュ戦略

| レイヤ | 対象 | TTL / 方針 |
| --- | --- | --- |
| CF エッジ | `/icon/*.svg` `/icon/*.mx` | `public, max-age=31536000, immutable`。更新時は該当 URL を purge |
| CF エッジ | `/api/search` | `public, max-age=60, s-maxage=300` |
| R2 | 原本 JSON | 更新時のみ put |
| Worker メモリ | per-collection JSON | isolate ライフサイクル内で LRU（最大 8 collection） |
| クライアント | SVG 実体 | Map<url,string> ＋ HTTP cache |
| クライアント | 検索結果 | SWR 最大 20 クエリ |

ingest 完了時に差分 collection の SVG URL を purge する。`/api/search` は max-age が短いため purge 不要。

### 9-4. 監視

- Cloudflare Workers Analytics でエラー率を追跡
- `console.error(JSON.stringify({...}))` で structured log。必要に応じ Logpush → R2
- 週次 ingest 失敗時は Actions 失敗通知でメール

## 10. テスト戦略

| 層 | ツール | 対象 |
| --- | --- | --- |
| 単体 | Vitest | `packages/core`、`apps/web/src/lib/svg.ts`、`tools/ingest/*` |
| コンポーネント | Vitest + `@testing-library/preact` | `packages/ui/*`（Host モック注入） |
| API | Vitest + `@cloudflare/vitest-pool-workers` | `/api/search` `/icon/*.svg` `/icon/*.mx`（Miniflare で D1/R2 バインディング再現） |
| E2E | Playwright | Preview URL に対し検索・SVG 描画・コピー動作 |
| 拡張 | `@vscode/test-electron` | activate、WebView 生成、postMessage の copy 経路 |

- フィクスチャ: mdi 100 icons、lucide 50 icons のミニ JSON で ingest → seed → 検索の一気通貫テスト
- シノニム展開・検索スコアの回帰テストをゴールデンとして保持

パフォーマンス予算:

- `/api/search` p95 < 200ms（cold）
- `/icon/*.svg` p95 < 50ms（cold）、< 5ms（cache hit）
- 検索 UI の入力→初回レンダリング < 300ms

CI で Playwright + `PerformanceObserver` を計測し、閾値超過で fail する。

## 11. 移行計画

### フェーズ 0: 準備（1 日）

- Cloudflare の R2 バケット / D1 データベース / Pages プロジェクト作成
- Azure AD アプリ + OIDC federation 設定
- `master` に monorepo 骨格をコミット。旧 `parsers/` `extension/` は残置

### フェーズ 1: ingest 稼働（〜3 日）

- `tools/ingest/*` を実装し、手動 dispatch で R2 と D1 を初回 seed
- 旧 `icons.kage1020.com` は触らない

### フェーズ 2: Web + API を preview で稼働（〜1 週間）

- Cloudflare Pages preview URL で `apps/web` を動作確認
- 旧 `icons.kage1020.com/{collection}/{name}.svg` と新 `/icon/{collection}/{name}.svg` を 100 件抜き取り比較（バイト一致か Iconify 正規化差の許容範囲かは移行時に確定）

### フェーズ 3: DNS 切替

- `icons.kage1020.com` を Pages プロジェクトに向ける
- 後方互換ルート: 旧 URL 形式 `/:collection/:name.svg` を Pages Function で `/icon/:collection/:name.svg` に内部 rewrite
- 現行 0.1.x 拡張の互換のため最低 6 か月維持

### フェーズ 4: 拡張リリース（DNS 切替の翌週）

- `apps/extension` を 1.0.0 として tag `ext-v1.0.0` で公開（OIDC publish）
- 新実装は Algolia SDK と旧 WebView HTML を含めない（Algolia アプリの解約はフェーズ 5）
- 既存ユーザーは自動アップデートで移行

### フェーズ 5: 旧資産の撤去（DNS 切替後 1 か月）

- 旧 `icons.kage1020.com` のホスティング停止
- ルート `parsers/` を削除、README を刷新
- Algolia アプリを解約

### ロールバック条件

- `/api/search` の 5xx 率が 1% を超える
- または DNS 切替から 24h 以内にアイコン欠損の報告
- DNS を旧 CNAME に戻し、旧構成を再稼働（フェーズ 5 まではデータ・スクリプトが残る前提）

## 12. 決定済み / 未決定 / 依存事項

決定済み:

- Cloudflare Pages / Workers / R2 / D1 採用
- Astro + Preact、tsup、pnpm、Biome、Vitest
- Iconify JSON を原本とする配信、D1 FTS5 + シノニム辞書
- Web デプロイは Cloudflare Git 連携、拡張は OIDC + `vsce --azure-credential`

未決定（実装時に決定）:

- D1 の分割（1 DB で足りるか、collection 群で分割か）
- Playwright の実行環境（GitHub Actions 単独か Cloudflare preview 併用か）
- SVG 差分検知の粒度（`{collection}.json` の sha256 か、icon 単位の hash か）

依存事項:

- Cloudflare アカウント（R2/D1/Pages 権限）
- Azure AD テナントと Marketplace publisher の管理権限
- 週次 ingest を実行するための Actions minutes
