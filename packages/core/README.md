# @icon-collection/core

- 型定義 (`IconHit`, `SearchQuery`, `SearchResponse`)
- クエリ正規化と FTS5 用のクエリ組立 (`normalizeQuery`, `buildFtsQuery`)
- 同義語辞書によるクエリ展開 (`expandQuery`)
- HTTP API クライアント (`createApiClient`, `ApiError`)

これらは Web (`apps/web`) と VSCode 拡張 (`apps/extension`) と ingest ツール (`tools/ingest`) の全てから参照される。
