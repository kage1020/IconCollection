# Implementation Plans

刷新は 5 プランで進める。各プランは独立にテスト可能・レビュー可能なゴールを持つ。

1. **[2026-07-12-monorepo-foundation.md](./2026-07-12-monorepo-foundation.md)** — pnpm monorepo 骨格 + `packages/core` `packages/synonyms` `packages/ui` + CI
2. **Ingest パイプライン** (未作成) — `tools/ingest`, R2 sync, D1 seed, weekly GitHub Actions
3. **Web + API** (未作成) — `apps/web` (Astro + Cloudflare Pages Functions), 検索・SVG・mx エンドポイント
4. **VSCode 拡張** (未作成) — `apps/extension` (tsup + Preact WebView), OIDC publish
5. **移行と撤去** (未作成) — DNS 切替、後方互換ルート、旧資産の撤去

刷新の背景・仕様は [../specs/2026-07-12-icon-collection-revamp-design.md](../specs/2026-07-12-icon-collection-revamp-design.md) を参照。
