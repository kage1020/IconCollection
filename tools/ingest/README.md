# @icon-collection/ingest

Iconify JSON を Cloudflare R2 に配置し、検索用メタデータを Cloudflare D1 の FTS5 テーブルへ投入する ingest パイプライン。

## 実行

```bash
pnpm -F @icon-collection/ingest start
```

## 環境変数

| 変数 | 用途 |
| --- | --- |
| `R2_ACCOUNT_ID` | R2 のアカウント ID |
| `R2_ACCESS_KEY_ID` | R2 の Access Key ID (S3 互換) |
| `R2_SECRET_ACCESS_KEY` | R2 の Secret Access Key |
| `R2_BUCKET` | R2 バケット名 |
| `CLOUDFLARE_API_TOKEN` | D1 API 用トークン (D1 の Read/Write 権限) |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare アカウント ID |
| `D1_DATABASE_ID` | D1 データベース ID |
| `INGEST_COLLECTIONS` (optional) | 対象コレクションのカンマ区切り上書き |
| `INGEST_DRY_RUN` (optional) | `1`/`true` で D1 への書き込みをスキップ |

## 対象コレクション (default)

`mdi`, `lucide`, `heroicons`, `tabler`, `bi`, `fa6-solid`, `fa6-regular`, `fa6-brands`, `material-symbols`, `carbon`, `radix-icons`, `octicon`, `ph`, `simple-icons`, `vscode-icons`

## パイプライン段

1. `applySchema` — D1 に `icons` / `icons_fts` / `synonyms` / `collection_meta` を idempotent に作る
2. `detectChanges` — `@iconify/json` のバージョンと R2 の `meta/version.json` を比較
3. `collectFromIconify` — 差分があるコレクションだけ JSON を読む
4. `syncSnapshotsToR2` — sha256 差分で R2 の `iconify/{collection}.json` を put
5. `seedIcons` — collection 単位で `DELETE` + 10 行バッチ `INSERT`（D1 の 100 bind-param 上限を尊重）
6. `seedSynonyms` — `@icon-collection/synonyms` から D1 の `synonyms` テーブルへ
7. `seedCollectionMeta` — `collection_meta` を upsert
8. `rebuildFts` — `INSERT INTO icons_fts(icons_fts) VALUES('rebuild')`

## Cloudflare 側の事前準備

1. R2 バケット `icon-collection` を作成し、API トークンで S3 互換キーを発行
2. D1 データベース `icon-collection` を作成し、`D1 Edit` 権限付き API トークンを発行
3. リポジトリの secrets に上記 7 変数を登録

## GitHub Actions

- `.github/workflows/ingest.yml` が週次で回る (毎週月曜 03:00 UTC)
- 手動実行時は `dry-run` オプションで D1 書き込みをスキップ可能
