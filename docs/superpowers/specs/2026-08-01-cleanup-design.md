# Plan E: Cleanup + Legacy Removal 設計仕様

**Status:** Draft
**Date:** 2026-08-01
**Depends on:** Plan B (`tools/ingest`), Plan C (`apps/web` + API), Plan D (`apps/vscode-extension`)

## 目的

revamp イニシアチブの最終段。旧アセット (`extension/`, `parsers/`) を削除し、旧 URL スキーム `/{c}/{n}.svg` に 301 redirect を敷いて既存参照との後方互換を担保する。あわせて Plan C/D の whole-branch review で挙がった Minor follow-up を一括で解消する。

## 非目的

- 新機能追加。既存挙動維持のクリーンアップ PR
- DNS 切替 (Cloudflare dashboard 操作、code-side には来ない。README に手順記載のみ)
- React Icons 独立コレクション対応 (別 plan)
- Semantic search 精度改善 (別 plan)

## スコープ

### A. 移行 (旧アセット除去 + 後方互換)

1. `apps/web/public/_redirects` (Cloudflare Pages 標準) に `/{c}/{n}.svg` → `/icon/{c}/{n}.svg` の 301 追加
   - `.svg` および `.mx` 拡張子のみに絞る (`/api/search` などが誤マッチしないよう suffix 制約)
2. `git rm -r extension/` (Plan D の `apps/vscode-extension` に置換済み)
3. `git rm -r parsers/` (Plan B の `tools/ingest` に置換済み)
4. root `README.md` を新構成に合わせて刷新 (旧 Algolia 記述削除、新 API / apps / packages 概要記載)

### B. Plan C/D 積み残しの一括解消

5. **`apps/vscode-extension` Tailwind pipeline** — `@tailwindcss/cli` を pre-build script にして `src/webview/main.css` を実際に処理させる。build 前に `tailwindcss -i src/webview/main.css -o dist/webview/main.css` を叩き、tsup の CSS copy は不要になるので loader 設定も見直す
6. **`apps/vscode-extension/tests/host-adapter.test.ts` に regression テスト追加** — `sanitizeApiBaseUrl` の userinfo drop (`https://user:pass@example.com` → `https://example.com`) と IPv6 origin (`https://[::1]:8443` → `https://[::1]:8443`) のケース
7. **`apps/vscode-extension/.vscodeignore`** に `CHANGELOG.md` + `!CHANGELOG.md` 再包含ペアを明示追加 (現状 default 動作で ships しているが、将来の編集耐性のため)
8. **`apps/web` 軽度クリーンアップ**:
   - 未使用 `happy-dom` を devDependencies から削除 (Plan C Task 9 で Workers pool に切替後、happy-dom は browser project でのみ使う想定だったが、vitest.browser.config.ts では `@preact/preset-vite` を経由してブラウザ相当環境を構築しており happy-dom は不要 — 確認のうえ削除)
   - `env.d.ts` の未使用 `ICON_DEFAULT_WIDTH?: string` 宣言を削除
   - `apps/web/tests/**` の `import { env } from 'cloudflare:test'` を `cloudflare:workers` に置換 (deprecated hint 解消)。テスト API 差異が出た場合は最小 shim
9. **`apps/web/functions/api/search.ts`** の empty expandQuery ブランチ (`fts.length === 0`) の cache-control を再検討 — 現状 `s-maxage=60, stale-while-revalidate=300` を返しているが、空クエリ (=空結果) は client-side バグの兆候であり CDN でキャッシュする価値が低い。`no-store` に変更、実際のヒットありパスのみ shared cache に載せる
10. **`tools/ingest/tests/_helpers.ts`** を新設し、`fakeBatchAtomic` (`run.test.ts` / `seed-icons.test.ts` / `seed-synonyms.test.ts` の 3 箇所で copy-paste されている bind param 数カウント regex ヘルパ) を集約。既存 3 テストは import に置換
11. **`tools/ingest/src/collect.ts` の overload 解消** — `run.ts` から呼ぶ `collect(collection, currentVersion)` を新 object 署名 `collect({ collection, load })` に書き換え、`collect.ts` の `(string, string)` overload を削除。`run.ts` は新 `load` として `require.resolve('@iconify/json/json/{collection}.json')` を返す関数を組む

### 除外項目

- `packages/ui/tests/_helpers.ts:21` の redundant `as ApiClient` cast — 挙動影響なし、削除しても得るものが薄いため放置
- Windows Electron GPU flakiness の xvfb 対応 — integration test を CI に載せる時に対応 (現状 CI で `test:integration` を叩いていない)
- root package.json rename の外部自動化影響監査 — 変更後 CI が数週間 green で走った事実で監査完了とみなす

## Global Constraints

- Node 22 LTS / pnpm 9 / TypeScript strict + all usual flags
- Biome 2 clean / Vitest 4
- 依存追加は `pnpm add` 経由、ハードコード禁止
- linter-ignore directive 禁止
- `_redirects` は Cloudflare Pages の Git integration deploy 時に自動反映される (Task 1 で置き場所は `apps/web/public/_redirects` = 出力先の `dist/_redirects` に static asset として copied される)
- 旧 `extension/` と `parsers/` の削除は **git rm** で確実に history に残す (削除履歴が消えないよう)
- `apps/web` の empty-search キャッシュ変更は既存 test を壊さないよう、テストに assertion を追加してから impl を修正 (TDD)

## Rollback

- 万一 `_redirects` が誤動作したら該当 line だけ削除して再 deploy
- `extension/` / `parsers/` の復元は `git revert` で 1 コマンド
- Tailwind pipeline 変更で WebView がスタイル崩れしたら、pre-build script を無効化して素の `main.css` (Plan D 現状) に戻すだけ

## Open Questions

なし。
