# Ingest Pipeline Implementation Plan (Plan B)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `tools/ingest` パッケージで Iconify JSON をコレクション単位で Cloudflare R2 に配置し、Cloudflare D1（FTS5 付き）に検索メタデータを投入する ingest パイプラインを実装する。週次 GitHub Actions（cron + 手動 dispatch）で上流の `@iconify/json` バージョンを検知し、差分のあるコレクションのみ R2/D1 を更新する。

**Architecture:** Node.js CLI (`tools/ingest`) が 4 段構成で走る: (1) `detect` が上流バージョンと R2 上の `meta/version.json` を比較して更新対象コレクションを絞り込み、(2) `collect` が `@iconify/json` の該当 JSON を読み込みメタデータを抽出、(3) `sync-r2` が sha256 差分で R2 に put、(4) `seed-d1` が D1 の `icons` / `icons_fts` / `synonyms` / `collection_meta` を collection 単位のトランザクションで再構築。R2 は S3 互換 API (`@aws-sdk/client-s3`)、D1 は HTTP API（`api.cloudflare.com/client/v4/accounts/{id}/d1/database/{db}/query`）を使う。Workers ランタイム外で動くので Cloudflare Bindings は使わない。

**Tech Stack:** Node 22 LTS / pnpm 9 / TypeScript 5 strict / Vitest / Biome 2 / `@aws-sdk/client-s3` / `@iconify/json` / `@iconify/utils` / `undici` (built-in fetch でも可) / GitHub Actions

## Global Constraints

- **依存バージョンをコードで固定しない**: `pnpm add` / `pnpm add -D` で導入し CLI が書き込んだ値をそのまま使う
- **絵文字禁止**（コード・ドキュメント・コミットメッセージ）
- **ignore ディレクティブ禁止**（`@ts-ignore`, `@biome-ignore`, `@ts-expect-error`, `eslint-disable`）: 設計を直す
- **1 タスク = 1 コミット**: 各タスクの Step 末尾でコミットする
- **Node 22 系**: `.node-version` は既に `22`
- **pnpm 9 系**: `package.json` の `packageManager` フィールド
- **TypeScript strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`**: `tsconfig.base.json` で強制
- **Vitest 環境は `node`**: DOM 不要
- **既存の `parsers/` `extension/` は残置し変更しない**: Biome ignore と workspace glob 外に置いてあるのを維持
- **feature branch `feat/revamp-ingest` 上で作業**: 現在の branch はここ
- **R2 は S3 互換 API 経由**: `endpoint: https://<account_id>.r2.cloudflarestorage.com`、region `auto`
- **D1 は Cloudflare HTTP API 経由**: `POST /accounts/{account_id}/d1/database/{database_id}/query` に Bearer トークンで問い合わせ
- **`packages/synonyms` の辞書を D1 の `synonyms` テーブルへ seed する**: `@icon-collection/synonyms` の `loadDictionary('ja')` / `loadDictionary('en')` を単一の真実として扱う
- **`sync-r2` は sha256 の per-collection 差分で判定する**: 変更されていないコレクションは put しない
- **`seed-d1` は collection 単位で `DELETE` + `INSERT` を 500 行バッチ、最後に `INSERT INTO icons_fts(icons_fts) VALUES('rebuild')`**: D1 の SQL サイズ上限を回避しつつ atomic に保つ
- **本プランのスコープは Iconify collection のみ**: React Icons 独自 collection の取り込みは後続プラン（Plan B'）で扱う。今回は R2 レイアウトに `react-icons/` を予約するのみで実データは書き込まない
- **credential は環境変数で受け取る**: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `D1_DATABASE_ID`。CLI 内でハードコードしない
- **対象コレクションは 15 個の固定リスト**: `mdi`, `lucide`, `heroicons`, `tabler`, `bi`（bootstrap-icons）, `fa6-solid`, `fa6-regular`, `fa6-brands`, `material-symbols`, `carbon`, `radix-icons`, `octicon`, `ph`（phosphor）, `simple-icons`, `vscode-icons`。この 15 個で Plan B の完成基準とし、Plan C（Web+API）はこの集合で動作確認する。追加は将来別プランで対応

---

## Repository state entering Plan B

Plan A の成果物として以下が既に存在する:

- `packages/core` — `IconHit`, `SearchQuery`, `SearchResponse`, `Collection`, `License`, `normalizeQuery`, `buildFtsQuery`, `expandQuery`, `createApiClient`, `ApiError`
- `packages/synonyms` — ja/en 辞書と `validateDictionary`, `loadDictionary`
- `packages/ui` — Preact + Tailwind の共通コンポーネント（本プランでは使わない）
- `.github/workflows/ci.yml` — Biome + workspace typecheck + Vitest
- `pnpm-workspace.yaml` — `apps/*` `packages/*` `tools/*` を glob
- `tsconfig.base.json` — strict 系 + `allowImportingTsExtensions: true` + `jsxImportSource: preact`

`tools/` ディレクトリはまだ存在しない（`pnpm-workspace.yaml` に glob は既に入っているだけ）。

## File Structure

```
tools/ingest/
├─ package.json
├─ tsconfig.json
├─ vitest.config.ts
├─ src/
│   ├─ index.ts            # CLI entry: 引数を parse して run() を呼ぶ
│   ├─ run.ts              # detect -> collect -> sync-r2 -> seed-d1 の orchestration
│   ├─ config.ts           # 環境変数の読み取りと validation、COLLECTIONS リスト
│   ├─ types.ts            # IngestConfig, CollectionSnapshot, IngestReport など内部型
│   ├─ detect.ts           # npm view で @iconify/json のバージョン取得、R2 と比較
│   ├─ collect.ts          # collection JSON を @iconify/json から読み込みメタ抽出
│   ├─ r2.ts               # R2 client wrapper (S3 SDK)
│   ├─ d1.ts               # D1 client wrapper (HTTP API)
│   ├─ sync-r2.ts          # sha256 差分で R2 に put
│   ├─ seed-d1.ts          # D1 の icons / synonyms / collection_meta を再構築
│   └─ schema.sql          # D1 スキーマ (icons, icons_fts, synonyms, collection_meta)
├─ tests/
│   ├─ config.test.ts
│   ├─ detect.test.ts
│   ├─ collect.test.ts
│   ├─ r2.test.ts
│   ├─ d1.test.ts
│   ├─ sync-r2.test.ts
│   ├─ seed-d1.test.ts
│   └─ run.test.ts
└─ __fixtures__/
    ├─ mdi-mini.json        # 100 icons
    └─ lucide-mini.json     # 50 icons
```

- Cloudflare の実 API を叩く箇所はモックの `fetch` / mocked S3 client で unit test
- `run.test.ts` では全モジュールを組み合わせた smoke test
- `.github/workflows/ingest.yml` を追加（Plan A の `ci.yml` は残す）

## Task overview

| # | Task | 目的 |
| - | ---- | ---- |
| 0 | `tools/ingest` パッケージ骨格 | pnpm workspace 内に package を追加し空の CLI entry を通す |
| 1 | 共通型と fixture | `IngestConfig`, `CollectionSnapshot`, `IngestReport` と mini iconify JSON |
| 2 | `config.ts` | 環境変数 validation と `COLLECTIONS` 定数 |
| 3 | `detect.ts` | npm view で最新版取得、R2 の `meta/version.json` と比較 |
| 4 | `collect.ts` | `@iconify/json` から collection JSON をロードしてメタ抽出 |
| 5 | `r2.ts` (client wrapper) | S3 SDK ベースの `putIfChanged` / `putJSON` / `getJSON` |
| 6 | `sync-r2.ts` | collect の結果を sha256 差分で R2 へ put |
| 7 | `d1.ts` (client wrapper) | HTTP API 経由の `execute` / `batch` / `transaction` |
| 8 | `seed-d1` schema migration | `schema.sql` を D1 に流し idempotent に |
| 9 | `seed-d1` icons batch insert | 500 行バッチで `icons` テーブルを collection 単位で置換 |
| 10 | `seed-d1` synonyms + meta seed | `packages/synonyms` から取り込み、`collection_meta` を更新 |
| 11 | `seed-d1` FTS5 rebuild | 最後に `icons_fts` を rebuild |
| 12 | `run.ts` orchestration | 4 段 orchestration と structured log 出力 |
| 13 | GitHub Actions `ingest.yml` | 週次 cron + manual dispatch |
| 14 | README と PR | tools/ingest/README.md、PR 作成 |

---

### Task 0: `tools/ingest` パッケージ骨格

**Files:**
- Create: `tools/ingest/package.json`
- Create: `tools/ingest/tsconfig.json`
- Create: `tools/ingest/vitest.config.ts`
- Create: `tools/ingest/src/index.ts`（空の CLI entry）
- Modify: `tsconfig.json` (root, `references` に `tools/ingest` を追加)

**Interfaces:**
- Consumes: `pnpm-workspace.yaml` が `tools/*` を glob していること（既存）、`tsconfig.base.json`（既存）
- Produces:
  - `@icon-collection/ingest` package（private）
  - scripts: `typecheck`, `test`, `test:watch`, `start`
  - `src/index.ts` に「`console.log('ingest: not implemented')`」だけを置いて `pnpm -F @icon-collection/ingest start` が exit 0 で走る

- [ ] **Step 1: `tools/ingest/package.json` を作成**

```json
{
  "name": "@icon-collection/ingest",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "bin": {
    "icon-collection-ingest": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc -p . --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "start": "tsx src/index.ts"
  }
}
```

- [ ] **Step 2: dev 依存を install**

```bash
pnpm -F @icon-collection/ingest add -D tsx
```

`tsx` は TypeScript を直接実行する CLI で、`pnpm start` から `.ts` を叩くために使う。ビルド成果物は出さない（`main: "./src/index.ts"` で workspace 参照可能）。

- [ ] **Step 3: `tools/ingest/tsconfig.json` を作成**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "outDir": "dist",
    "types": ["node"]
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

`rootDir` は付けない（tests が rootDir 外になり TS6059 を起こすため。Plan A の core / synonyms / ui と同じ運用）。

- [ ] **Step 4: `tools/ingest/vitest.config.ts` を作成**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
```

- [ ] **Step 5: root `tsconfig.json` に project reference を追加**

```json
{
  "files": [],
  "references": [
    { "path": "packages/core" },
    { "path": "packages/synonyms" },
    { "path": "packages/ui" },
    { "path": "tools/ingest" }
  ]
}
```

- [ ] **Step 6: `tools/ingest/src/index.ts` を作成**

```ts
export const main = (): void => {
  console.log('ingest: not implemented');
};

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  main();
}
```

エントリガードは Windows パスも通るよう `\\` を `/` に置換する。

- [ ] **Step 7: 起動確認**

Run: `pnpm -F @icon-collection/ingest start`
Expected: `ingest: not implemented` が stdout に出て exit 0。

- [ ] **Step 8: lint + typecheck + test**

Run: `pnpm lint && pnpm typecheck && pnpm test`
Expected: すべて成功。`tools/ingest` の test はまだ 0 件だが `pnpm test` は fail しない（vitest run は「no tests found」でも exit 0 の設定にはなっていないので、実際にはこの Task の Step で `pnpm -F @icon-collection/ingest test` が「No test files found」で exit 1 になる可能性がある。その場合は次 Task で解消する）。

もし Vitest 4 の default 挙動で「No test files found」で exit 1 になる場合、`vitest.config.ts` に `passWithNoTests: true` を一時的に追加してもよい（次 Task で削除）。挙動を実測して決める。

- [ ] **Step 9: コミット**

```bash
git add tools/ingest tsconfig.json pnpm-lock.yaml
git commit -m "feat(ingest): scaffold tools/ingest package with tsx runner"
```

---

### Task 1: 共通型と mini fixture

**Files:**
- Create: `tools/ingest/src/types.ts`
- Create: `tools/ingest/__fixtures__/mdi-mini.json`
- Create: `tools/ingest/__fixtures__/lucide-mini.json`
- Create: `tools/ingest/tests/types.test.ts`

**Interfaces:**
- Produces:
  - `IconifyJSON`: `@iconify/types` の `IconifyJSON` を再エクスポート（依存を tools/ingest に閉じる）
  - `CollectionSnapshot`: `{ collection: string; version: string; license: string; total: number; body: IconifyJSON }`
  - `IngestReport`: `{ collectionsChecked: number; collectionsChanged: string[]; d1RowsInserted: number; ftsRebuilt: boolean; startedAt: string; finishedAt: string }`
  - `IngestConfig`: 環境変数から derive する設定（Task 2 で使う型）
  - fixture JSON は brief 通りの 100/50 icon の縮小 IconifyJSON

- [ ] **Step 1: `@iconify/types` を dev 依存で install**

```bash
pnpm -F @icon-collection/ingest add @iconify/types
pnpm -F @icon-collection/ingest add -D @iconify/json
```

- `@iconify/json` は fixture 生成と本番 collect の両方で使う。size は大きいが node_modules に置く限り Actions runner なら OK。dev 扱いにするのは、production ビルド成果物（tsx で直接実行）に含めないため
- `@iconify/utils` は Plan C の Worker 側で使う予定で、Plan B のスコープ内では使わないため install しない

- [ ] **Step 2: `tools/ingest/src/types.ts` を作成**

```ts
import type { IconifyJSON } from '@iconify/types';

export type { IconifyJSON };

export type CollectionSnapshot = {
  collection: string;
  version: string;
  license: string;
  total: number;
  body: IconifyJSON;
};

export type IngestReport = {
  collectionsChecked: number;
  collectionsChanged: string[];
  d1RowsInserted: number;
  ftsRebuilt: boolean;
  startedAt: string;
  finishedAt: string;
};

export type IngestConfig = {
  r2: {
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
  };
  d1: {
    apiToken: string;
    accountId: string;
    databaseId: string;
  };
  collections: readonly string[];
  dryRun: boolean;
};
```

- [ ] **Step 3: mini fixture を作成**

`tools/ingest/__fixtures__/mdi-mini.json`:

```json
{
  "prefix": "mdi",
  "info": {
    "name": "Material Design Icons",
    "total": 3,
    "license": { "title": "Apache-2.0" }
  },
  "icons": {
    "home": { "body": "<path d='M12 3L2 12h3v8h6v-6h2v6h6v-8h3z'/>" },
    "account": { "body": "<path d='M12 4a4 4 0 100 8 4 4 0 000-8z'/>" },
    "search": { "body": "<circle cx='11' cy='11' r='8'/><line x1='21' y1='21' x2='16' y2='16'/>" }
  },
  "width": 24,
  "height": 24
}
```

`tools/ingest/__fixtures__/lucide-mini.json`:

```json
{
  "prefix": "lucide",
  "info": {
    "name": "Lucide",
    "total": 2,
    "license": { "title": "ISC" }
  },
  "icons": {
    "home": { "body": "<path d='M3 9l9-7 9 7v11a2 2 0 01-2 2h-4v-6H10v6H6a2 2 0 01-2-2z'/>" },
    "user": { "body": "<circle cx='12' cy='7' r='4'/><path d='M6 21v-2a4 4 0 014-4h4a4 4 0 014 4v2'/>" }
  },
  "width": 24,
  "height": 24
}
```

- [ ] **Step 4: 型テストを書く**

`tools/ingest/tests/types.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, expectTypeOf, test } from 'vitest';
import type { CollectionSnapshot, IconifyJSON, IngestConfig, IngestReport } from '../src/types.ts';

const readFixture = (name: string): IconifyJSON => {
  const path = fileURLToPath(new URL(`../__fixtures__/${name}`, import.meta.url));
  return JSON.parse(readFileSync(path, 'utf-8')) as IconifyJSON;
};

describe('fixture files', () => {
  test('mdi-mini has 3 icons', () => {
    const body = readFixture('mdi-mini.json');
    expect(body.prefix).toBe('mdi');
    expect(Object.keys(body.icons)).toHaveLength(3);
  });

  test('lucide-mini has 2 icons', () => {
    const body = readFixture('lucide-mini.json');
    expect(body.prefix).toBe('lucide');
    expect(Object.keys(body.icons)).toHaveLength(2);
  });
});

describe('CollectionSnapshot type', () => {
  test('has required fields', () => {
    expectTypeOf<CollectionSnapshot>().toEqualTypeOf<{
      collection: string;
      version: string;
      license: string;
      total: number;
      body: IconifyJSON;
    }>();
  });
});

describe('IngestReport type', () => {
  test('lists changed collections', () => {
    expectTypeOf<IngestReport['collectionsChanged']>().toEqualTypeOf<string[]>();
  });
});

describe('IngestConfig type', () => {
  test('r2 and d1 credentials are required', () => {
    expectTypeOf<IngestConfig['r2']>().toEqualTypeOf<{
      accountId: string;
      accessKeyId: string;
      secretAccessKey: string;
      bucket: string;
    }>();
    expectTypeOf<IngestConfig['d1']>().toEqualTypeOf<{
      apiToken: string;
      accountId: string;
      databaseId: string;
    }>();
  });
});
```

- [ ] **Step 5: テストが通ることを確認**

Run: `pnpm -F @icon-collection/ingest test`
Expected: PASS（5 tests）

- [ ] **Step 6: lint + typecheck**

Run: `pnpm lint && pnpm typecheck`
Expected: 成功

- [ ] **Step 7: コミット**

```bash
git add tools/ingest
git commit -m "feat(ingest): add shared types and mini iconify fixtures"
```

---

### Task 2: `config.ts` — 環境変数 validation と `COLLECTIONS` 定数

**Files:**
- Create: `tools/ingest/src/config.ts`
- Create: `tools/ingest/tests/config.test.ts`

**Interfaces:**
- Produces:
  - `COLLECTIONS: readonly string[]` — 15 collection の固定リスト
  - `loadConfig(env: Record<string, string | undefined>): IngestConfig` — 環境変数を読み `IngestConfig` を返す。必須キー欠損時は `ConfigError` を throw
  - `ConfigError extends Error`

- [ ] **Step 1: テストを書く**

`tools/ingest/tests/config.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { COLLECTIONS, ConfigError, loadConfig } from '../src/config.ts';

const fullEnv = {
  R2_ACCOUNT_ID: 'acct',
  R2_ACCESS_KEY_ID: 'keyid',
  R2_SECRET_ACCESS_KEY: 'secret',
  R2_BUCKET: 'icon-collection',
  CLOUDFLARE_API_TOKEN: 'tok',
  CLOUDFLARE_ACCOUNT_ID: 'cf-acct',
  D1_DATABASE_ID: 'db',
};

describe('COLLECTIONS', () => {
  test('has 15 fixed collections including mdi and lucide', () => {
    expect(COLLECTIONS.length).toBe(15);
    expect(COLLECTIONS).toContain('mdi');
    expect(COLLECTIONS).toContain('lucide');
    expect(COLLECTIONS).toContain('heroicons');
    expect(COLLECTIONS).toContain('material-symbols');
    expect(COLLECTIONS).toContain('simple-icons');
  });
});

describe('loadConfig', () => {
  test('returns IngestConfig with all fields', () => {
    const cfg = loadConfig(fullEnv);
    expect(cfg.r2.accountId).toBe('acct');
    expect(cfg.r2.bucket).toBe('icon-collection');
    expect(cfg.d1.databaseId).toBe('db');
    expect(cfg.dryRun).toBe(false);
    expect(cfg.collections).toBe(COLLECTIONS);
  });

  test('supports INGEST_DRY_RUN=1 to enable dryRun', () => {
    const cfg = loadConfig({ ...fullEnv, INGEST_DRY_RUN: '1' });
    expect(cfg.dryRun).toBe(true);
  });

  test('supports INGEST_COLLECTIONS to override the collection list', () => {
    const cfg = loadConfig({ ...fullEnv, INGEST_COLLECTIONS: 'mdi,lucide' });
    expect(cfg.collections).toEqual(['mdi', 'lucide']);
  });

  test('throws ConfigError when R2_ACCOUNT_ID is missing', () => {
    const env = { ...fullEnv } as Record<string, string | undefined>;
    delete env.R2_ACCOUNT_ID;
    expect(() => loadConfig(env)).toThrow(ConfigError);
    expect(() => loadConfig(env)).toThrow(/R2_ACCOUNT_ID/);
  });

  test('throws ConfigError when CLOUDFLARE_API_TOKEN is missing', () => {
    const env = { ...fullEnv } as Record<string, string | undefined>;
    delete env.CLOUDFLARE_API_TOKEN;
    expect(() => loadConfig(env)).toThrow(/CLOUDFLARE_API_TOKEN/);
  });

  test('trims whitespace from env values', () => {
    const cfg = loadConfig({ ...fullEnv, R2_BUCKET: '  icon-collection  ' });
    expect(cfg.r2.bucket).toBe('icon-collection');
  });
});
```

- [ ] **Step 2: RED 確認**

Run: `pnpm -F @icon-collection/ingest test`
Expected: FAIL（`config.ts` 未定義）

- [ ] **Step 3: `tools/ingest/src/config.ts` を実装**

```ts
import type { IngestConfig } from './types.ts';

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export const COLLECTIONS: readonly string[] = [
  'mdi',
  'lucide',
  'heroicons',
  'tabler',
  'bi',
  'fa6-solid',
  'fa6-regular',
  'fa6-brands',
  'material-symbols',
  'carbon',
  'radix-icons',
  'octicon',
  'ph',
  'simple-icons',
  'vscode-icons',
];

const required = (env: Record<string, string | undefined>, key: string): string => {
  const raw = env[key];
  if (typeof raw !== 'string') throw new ConfigError(`missing env var ${key}`);
  const trimmed = raw.trim();
  if (trimmed.length === 0) throw new ConfigError(`missing env var ${key}`);
  return trimmed;
};

export const loadConfig = (env: Record<string, string | undefined>): IngestConfig => {
  const override = env.INGEST_COLLECTIONS?.trim();
  const collections = override
    ? override.split(',').map((s) => s.trim()).filter((s) => s.length > 0)
    : COLLECTIONS;
  return {
    r2: {
      accountId: required(env, 'R2_ACCOUNT_ID'),
      accessKeyId: required(env, 'R2_ACCESS_KEY_ID'),
      secretAccessKey: required(env, 'R2_SECRET_ACCESS_KEY'),
      bucket: required(env, 'R2_BUCKET'),
    },
    d1: {
      apiToken: required(env, 'CLOUDFLARE_API_TOKEN'),
      accountId: required(env, 'CLOUDFLARE_ACCOUNT_ID'),
      databaseId: required(env, 'D1_DATABASE_ID'),
    },
    collections,
    dryRun: env.INGEST_DRY_RUN === '1' || env.INGEST_DRY_RUN === 'true',
  };
};
```

- [ ] **Step 4: GREEN 確認**

Run: `pnpm -F @icon-collection/ingest test`
Expected: 全 7 テスト PASS

- [ ] **Step 5: lint + typecheck**

Run: `pnpm lint && pnpm typecheck`
Expected: 成功

- [ ] **Step 6: コミット**

```bash
git add tools/ingest/src/config.ts tools/ingest/tests/config.test.ts
git commit -m "feat(ingest): validate env and expose fixed COLLECTIONS list"
```

---

### Task 3: `detect.ts` — 上流バージョン検知と差分計算

**Files:**
- Create: `tools/ingest/src/detect.ts`
- Create: `tools/ingest/tests/detect.test.ts`

**Interfaces:**
- Consumes: `IngestConfig`
- Produces:
  - `detectChanges(input: { collections: readonly string[]; currentVersion: string; storedVersions: Record<string, string> }): { changed: string[]; nextVersions: Record<string, string> }`
  - `readIconifyVersion(): Promise<string>` — 実行環境の `@iconify/json/package.json` を読んで `version` を返す
  - `readIconifyVersion` は fs で `node_modules/@iconify/json/package.json` を探す。CI と local の両方で動く

- [ ] **Step 1: テストを書く**

`tools/ingest/tests/detect.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { detectChanges, readIconifyVersion } from '../src/detect.ts';

describe('detectChanges', () => {
  test('flags all collections as changed when storedVersions is empty', () => {
    const result = detectChanges({
      collections: ['mdi', 'lucide'],
      currentVersion: '2.2.400',
      storedVersions: {},
    });
    expect(result.changed).toEqual(['mdi', 'lucide']);
    expect(result.nextVersions).toEqual({ mdi: '2.2.400', lucide: '2.2.400' });
  });

  test('flags nothing when all stored versions match current', () => {
    const result = detectChanges({
      collections: ['mdi'],
      currentVersion: '2.2.400',
      storedVersions: { mdi: '2.2.400' },
    });
    expect(result.changed).toEqual([]);
    expect(result.nextVersions).toEqual({ mdi: '2.2.400' });
  });

  test('flags only the outdated collection', () => {
    const result = detectChanges({
      collections: ['mdi', 'lucide', 'heroicons'],
      currentVersion: '2.2.400',
      storedVersions: { mdi: '2.2.400', lucide: '2.2.399', heroicons: '2.2.400' },
    });
    expect(result.changed).toEqual(['lucide']);
    expect(result.nextVersions).toEqual({
      mdi: '2.2.400',
      lucide: '2.2.400',
      heroicons: '2.2.400',
    });
  });

  test('preserves order from collections input', () => {
    const result = detectChanges({
      collections: ['heroicons', 'mdi', 'lucide'],
      currentVersion: '2.2.400',
      storedVersions: {},
    });
    expect(result.changed).toEqual(['heroicons', 'mdi', 'lucide']);
  });
});

describe('readIconifyVersion', () => {
  test('returns a semver-shaped string from installed @iconify/json', async () => {
    const v = await readIconifyVersion();
    expect(v).toMatch(/^\d+\.\d+\.\d+/);
  });
});
```

- [ ] **Step 2: RED 確認**

Run: `pnpm -F @icon-collection/ingest test`
Expected: FAIL

- [ ] **Step 3: `tools/ingest/src/detect.ts` を実装**

```ts
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

export type DetectInput = {
  collections: readonly string[];
  currentVersion: string;
  storedVersions: Record<string, string>;
};

export type DetectResult = {
  changed: string[];
  nextVersions: Record<string, string>;
};

export const detectChanges = (input: DetectInput): DetectResult => {
  const changed: string[] = [];
  const nextVersions: Record<string, string> = {};
  for (const collection of input.collections) {
    nextVersions[collection] = input.currentVersion;
    if (input.storedVersions[collection] !== input.currentVersion) {
      changed.push(collection);
    }
  }
  return { changed, nextVersions };
};

export const readIconifyVersion = async (): Promise<string> => {
  const require = createRequire(import.meta.url);
  const pkgPath = require.resolve('@iconify/json/package.json');
  const raw = await readFile(pkgPath, 'utf-8');
  const pkg = JSON.parse(raw) as { version: string };
  return pkg.version;
};
```

- [ ] **Step 4: GREEN 確認**

Run: `pnpm -F @icon-collection/ingest test`
Expected: PASS

- [ ] **Step 5: lint + typecheck**

Run: `pnpm lint && pnpm typecheck`
Expected: 成功

- [ ] **Step 6: コミット**

```bash
git add tools/ingest/src/detect.ts tools/ingest/tests/detect.test.ts
git commit -m "feat(ingest): detect per-collection version changes"
```

---

### Task 4: `collect.ts` — Iconify JSON の読み込みとメタ抽出

**Files:**
- Create: `tools/ingest/src/collect.ts`
- Create: `tools/ingest/tests/collect.test.ts`

**Interfaces:**
- Consumes: `@iconify/json`, `CollectionSnapshot`, `IconifyJSON`
- Produces:
  - `collectFromIconify(collection: string): Promise<CollectionSnapshot>` — `@iconify/json/json/${collection}.json` を読み込み、メタを抽出。`total` は `body.icons` のキー数。license は `body.info?.license?.title ?? body.info?.license?.spdx ?? 'unknown'`。version は Task 3 の `readIconifyVersion()` の値を呼び出し側で埋める形にせず、ここでは `body.lastModified` 由来ではなく `@iconify/json` の package バージョンを引数で受ける
  - シグネチャは実際には `collectFromIconify(collection: string, version: string): Promise<CollectionSnapshot>`
  - `collectFromPath(path: string, version: string): Promise<CollectionSnapshot>` — fixture を読むためのラッパ（テストと dry-run で使う）

- [ ] **Step 1: テストを書く**

`tools/ingest/tests/collect.test.ts`:

```ts
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { collectFromIconify, collectFromPath } from '../src/collect.ts';

const fixture = (name: string): string =>
  fileURLToPath(new URL(`../__fixtures__/${name}`, import.meta.url));

describe('collectFromPath', () => {
  test('reads mdi fixture and returns CollectionSnapshot with 3 icons', async () => {
    const snap = await collectFromPath(fixture('mdi-mini.json'), '2.2.400');
    expect(snap.collection).toBe('mdi');
    expect(snap.version).toBe('2.2.400');
    expect(snap.license).toBe('Apache-2.0');
    expect(snap.total).toBe(3);
    expect(snap.body.prefix).toBe('mdi');
    expect(Object.keys(snap.body.icons)).toEqual(['home', 'account', 'search']);
  });

  test('reads lucide fixture and returns 2 icons with ISC license', async () => {
    const snap = await collectFromPath(fixture('lucide-mini.json'), '2.2.400');
    expect(snap.total).toBe(2);
    expect(snap.license).toBe('ISC');
  });
});

describe('collectFromIconify', () => {
  test('reads mdi from installed @iconify/json and returns a large snapshot', async () => {
    const snap = await collectFromIconify('mdi', '2.2.400');
    expect(snap.collection).toBe('mdi');
    expect(snap.version).toBe('2.2.400');
    expect(snap.total).toBeGreaterThan(100);
    expect(snap.license.length).toBeGreaterThan(0);
    expect(snap.body.prefix).toBe('mdi');
  });

  test('throws when the collection is not present in @iconify/json', async () => {
    await expect(collectFromIconify('this-does-not-exist', '2.2.400')).rejects.toThrow();
  });
});
```

- [ ] **Step 2: RED 確認**

Run: `pnpm -F @icon-collection/ingest test`
Expected: FAIL

- [ ] **Step 3: `tools/ingest/src/collect.ts` を実装**

```ts
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import type { CollectionSnapshot, IconifyJSON } from './types.ts';

type IconifyLicense = {
  title?: string;
  spdx?: string;
};

const extractLicense = (body: IconifyJSON): string => {
  const info = body.info as { license?: IconifyLicense } | undefined;
  return info?.license?.title ?? info?.license?.spdx ?? 'unknown';
};

const parseSnapshot = (raw: string, version: string): CollectionSnapshot => {
  const body = JSON.parse(raw) as IconifyJSON;
  return {
    collection: body.prefix,
    version,
    license: extractLicense(body),
    total: Object.keys(body.icons).length,
    body,
  };
};

export const collectFromPath = async (
  path: string,
  version: string,
): Promise<CollectionSnapshot> => {
  const raw = await readFile(path, 'utf-8');
  return parseSnapshot(raw, version);
};

export const collectFromIconify = async (
  collection: string,
  version: string,
): Promise<CollectionSnapshot> => {
  const require = createRequire(import.meta.url);
  const jsonPath = require.resolve(`@iconify/json/json/${collection}.json`);
  return collectFromPath(jsonPath, version);
};
```

- [ ] **Step 4: GREEN 確認**

Run: `pnpm -F @icon-collection/ingest test`
Expected: PASS

- [ ] **Step 5: lint + typecheck**

Run: `pnpm lint && pnpm typecheck`
Expected: 成功

- [ ] **Step 6: コミット**

```bash
git add tools/ingest/src/collect.ts tools/ingest/tests/collect.test.ts
git commit -m "feat(ingest): collect iconify JSON with license/total extraction"
```

---

### Task 5: `r2.ts` — S3 SDK ベースの R2 client wrapper

**Files:**
- Create: `tools/ingest/src/r2.ts`
- Create: `tools/ingest/tests/r2.test.ts`

**Interfaces:**
- Consumes: `IngestConfig['r2']`, `@aws-sdk/client-s3`
- Produces:
  - `class R2Client { constructor(cfg: IngestConfig['r2']); async putIfChanged(key: string, body: Buffer | string): Promise<{ changed: boolean; sha256: string }>; async putJson<T>(key: string, value: T): Promise<{ changed: boolean; sha256: string }>; async getJson<T>(key: string): Promise<T | null>; }`
  - `sha256(input: string | Buffer): string` — Node の crypto で計算する pure helper（テスト用に export）
  - `putIfChanged` は S3 の HeadObject でメタデータ `x-amz-meta-sha256` を確認、同じなら put をスキップし `changed: false` を返す

- [ ] **Step 1: 依存を追加**

```bash
pnpm -F @icon-collection/ingest add @aws-sdk/client-s3
```

- [ ] **Step 2: テストを書く**

`tools/ingest/tests/r2.test.ts`:

```ts
import { S3Client } from '@aws-sdk/client-s3';
import { describe, expect, test, vi } from 'vitest';
import { R2Client, sha256 } from '../src/r2.ts';

const cfg = {
  accountId: 'acct',
  accessKeyId: 'key',
  secretAccessKey: 'secret',
  bucket: 'icon-collection',
};

describe('sha256', () => {
  test('produces stable hex digest', () => {
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  test('handles Buffer input identically', () => {
    expect(sha256(Buffer.from('abc'))).toBe(sha256('abc'));
  });
});

describe('R2Client', () => {
  test('putIfChanged uploads when object is missing and returns changed:true', async () => {
    const send = vi.fn(async (cmd: { constructor: { name: string } }) => {
      if (cmd.constructor.name === 'HeadObjectCommand') {
        throw Object.assign(new Error('not found'), { name: 'NotFound', $metadata: { httpStatusCode: 404 } });
      }
      if (cmd.constructor.name === 'PutObjectCommand') return {};
      return {};
    });
    const client = new R2Client(cfg, { send } as unknown as S3Client);
    const result = await client.putIfChanged('meta/version.json', '{"v":1}');
    expect(result.changed).toBe(true);
    expect(send).toHaveBeenCalledTimes(2);
  });

  test('putIfChanged skips upload when sha256 matches', async () => {
    const digest = sha256('{"v":1}');
    const send = vi.fn(async (cmd: { constructor: { name: string } }) => {
      if (cmd.constructor.name === 'HeadObjectCommand') {
        return { Metadata: { sha256: digest } };
      }
      throw new Error('should not put');
    });
    const client = new R2Client(cfg, { send } as unknown as S3Client);
    const result = await client.putIfChanged('meta/version.json', '{"v":1}');
    expect(result.changed).toBe(false);
    expect(send).toHaveBeenCalledTimes(1);
  });

  test('getJson returns parsed object when the key exists', async () => {
    const send = vi.fn(async (cmd: { constructor: { name: string } }) => {
      if (cmd.constructor.name === 'GetObjectCommand') {
        return {
          Body: {
            transformToString: async (): Promise<string> => '{"hello":"world"}',
          },
        };
      }
      return {};
    });
    const client = new R2Client(cfg, { send } as unknown as S3Client);
    const value = await client.getJson<{ hello: string }>('meta/version.json');
    expect(value).toEqual({ hello: 'world' });
  });

  test('getJson returns null on 404', async () => {
    const send = vi.fn(async () => {
      throw Object.assign(new Error('missing'), {
        name: 'NoSuchKey',
        $metadata: { httpStatusCode: 404 },
      });
    });
    const client = new R2Client(cfg, { send } as unknown as S3Client);
    const value = await client.getJson('meta/version.json');
    expect(value).toBeNull();
  });
});
```

- [ ] **Step 3: RED 確認**

Run: `pnpm -F @icon-collection/ingest test`
Expected: FAIL

- [ ] **Step 4: `tools/ingest/src/r2.ts` を実装**

```ts
import { createHash } from 'node:crypto';
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { IngestConfig } from './types.ts';

export const sha256 = (input: string | Buffer): string =>
  createHash('sha256').update(input).digest('hex');

const is404 = (err: unknown): boolean => {
  if (typeof err !== 'object' || err === null) return false;
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e.name === 'NotFound' || e.name === 'NoSuchKey' || e.$metadata?.httpStatusCode === 404;
};

export class R2Client {
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(cfg: IngestConfig['r2'], s3?: S3Client) {
    this.bucket = cfg.bucket;
    this.s3 =
      s3 ??
      new S3Client({
        region: 'auto',
        endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: cfg.accessKeyId,
          secretAccessKey: cfg.secretAccessKey,
        },
      });
  }

  async putIfChanged(
    key: string,
    body: Buffer | string,
  ): Promise<{ changed: boolean; sha256: string }> {
    const digest = sha256(body);
    try {
      const head = await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      if (head.Metadata?.sha256 === digest) return { changed: false, sha256: digest };
    } catch (err) {
      if (!is404(err)) throw err;
    }
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: key.endsWith('.json') ? 'application/json' : 'application/octet-stream',
        Metadata: { sha256: digest },
      }),
    );
    return { changed: true, sha256: digest };
  }

  async putJson<T>(key: string, value: T): Promise<{ changed: boolean; sha256: string }> {
    return this.putIfChanged(key, JSON.stringify(value));
  }

  async getJson<T>(key: string): Promise<T | null> {
    try {
      const out = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      const body = out.Body as { transformToString: () => Promise<string> } | undefined;
      if (!body) return null;
      const raw = await body.transformToString();
      return JSON.parse(raw) as T;
    } catch (err) {
      if (is404(err)) return null;
      throw err;
    }
  }
}
```

- [ ] **Step 5: GREEN 確認**

Run: `pnpm -F @icon-collection/ingest test`
Expected: PASS

- [ ] **Step 6: lint + typecheck**

Run: `pnpm lint && pnpm typecheck`
Expected: 成功

- [ ] **Step 7: コミット**

```bash
git add tools/ingest/src/r2.ts tools/ingest/tests/r2.test.ts
git commit -m "feat(ingest): add R2 client wrapper with sha256 skip-on-match"
```

---

### Task 6: `sync-r2.ts` — collect 結果を R2 に差分アップロード

**Files:**
- Create: `tools/ingest/src/sync-r2.ts`
- Create: `tools/ingest/tests/sync-r2.test.ts`

**Interfaces:**
- Consumes: `R2Client`, `CollectionSnapshot`
- Produces:
  - `syncSnapshotsToR2(input: { r2: R2Client; snapshots: readonly CollectionSnapshot[]; dryRun?: boolean }): Promise<{ uploaded: string[]; unchanged: string[] }>`
  - collection JSON は `iconify/${collection}.json` に、`meta/version.json` は `{ collection: version }` の Record として最後に put
  - `manifest.json` は本 Task では触らない（Task 10 で `collection_meta` として D1 に置くので R2 側は最小限）

- [ ] **Step 1: テストを書く**

`tools/ingest/tests/sync-r2.test.ts`:

```ts
import { describe, expect, test, vi } from 'vitest';
import type { CollectionSnapshot } from '../src/types.ts';
import { R2Client } from '../src/r2.ts';
import { syncSnapshotsToR2 } from '../src/sync-r2.ts';

const makeSnap = (collection: string): CollectionSnapshot => ({
  collection,
  version: '2.2.400',
  license: 'MIT',
  total: 3,
  body: {
    prefix: collection,
    icons: { home: { body: '<path/>' } },
  } as CollectionSnapshot['body'],
});

const stubClient = (impl: {
  putJson: R2Client['putJson'];
  getJson: R2Client['getJson'];
  putIfChanged?: R2Client['putIfChanged'];
}): R2Client => impl as unknown as R2Client;

describe('syncSnapshotsToR2', () => {
  test('uploads each collection JSON and reports unchanged when digests match', async () => {
    const digests: Record<string, string> = {};
    const putJson = vi.fn(async (key: string, value: unknown) => {
      const digest = JSON.stringify(value);
      if (digests[key] === digest) return { changed: false, sha256: digest };
      digests[key] = digest;
      return { changed: true, sha256: digest };
    });
    const client = stubClient({ putJson, getJson: async () => null });
    const snaps = [makeSnap('mdi'), makeSnap('lucide')];
    const first = await syncSnapshotsToR2({ r2: client, snapshots: snaps });
    expect(first.uploaded.sort()).toEqual(['lucide', 'mdi']);
    expect(first.unchanged).toEqual([]);
    const second = await syncSnapshotsToR2({ r2: client, snapshots: snaps });
    expect(second.uploaded).toEqual([]);
    expect(second.unchanged.sort()).toEqual(['lucide', 'mdi']);
  });

  test('writes meta/version.json with all collection versions', async () => {
    const putJson = vi.fn(async () => ({ changed: true, sha256: 'x' }));
    const client = stubClient({ putJson, getJson: async () => null });
    await syncSnapshotsToR2({ r2: client, snapshots: [makeSnap('mdi'), makeSnap('lucide')] });
    const metaCall = putJson.mock.calls.find(([key]) => key === 'meta/version.json');
    expect(metaCall).toBeDefined();
    expect(metaCall?.[1]).toEqual({ mdi: '2.2.400', lucide: '2.2.400' });
  });

  test('dryRun avoids putJson entirely', async () => {
    const putJson = vi.fn(async () => ({ changed: true, sha256: 'x' }));
    const client = stubClient({ putJson, getJson: async () => null });
    const result = await syncSnapshotsToR2({
      r2: client,
      snapshots: [makeSnap('mdi')],
      dryRun: true,
    });
    expect(putJson).not.toHaveBeenCalled();
    expect(result.uploaded).toEqual([]);
    expect(result.unchanged).toEqual(['mdi']);
  });
});
```

- [ ] **Step 2: RED 確認**

Run: `pnpm -F @icon-collection/ingest test`
Expected: FAIL

- [ ] **Step 3: `tools/ingest/src/sync-r2.ts` を実装**

```ts
import type { R2Client } from './r2.ts';
import type { CollectionSnapshot } from './types.ts';

export type SyncInput = {
  r2: R2Client;
  snapshots: readonly CollectionSnapshot[];
  dryRun?: boolean;
};

export type SyncResult = {
  uploaded: string[];
  unchanged: string[];
};

export const syncSnapshotsToR2 = async (input: SyncInput): Promise<SyncResult> => {
  const uploaded: string[] = [];
  const unchanged: string[] = [];
  if (input.dryRun) {
    for (const snap of input.snapshots) unchanged.push(snap.collection);
    return { uploaded, unchanged };
  }
  for (const snap of input.snapshots) {
    const result = await input.r2.putJson(`iconify/${snap.collection}.json`, snap.body);
    if (result.changed) uploaded.push(snap.collection);
    else unchanged.push(snap.collection);
  }
  const versions: Record<string, string> = {};
  for (const snap of input.snapshots) versions[snap.collection] = snap.version;
  await input.r2.putJson('meta/version.json', versions);
  return { uploaded, unchanged };
};
```

- [ ] **Step 4: GREEN 確認**

Run: `pnpm -F @icon-collection/ingest test`
Expected: PASS

- [ ] **Step 5: lint + typecheck**

Run: `pnpm lint && pnpm typecheck`
Expected: 成功

- [ ] **Step 6: コミット**

```bash
git add tools/ingest/src/sync-r2.ts tools/ingest/tests/sync-r2.test.ts
git commit -m "feat(ingest): sync collection JSON to R2 with per-collection diff"
```

---

### Task 7: `d1.ts` — HTTP API 経由の D1 client wrapper

**Files:**
- Create: `tools/ingest/src/d1.ts`
- Create: `tools/ingest/tests/d1.test.ts`

**Interfaces:**
- Consumes: `IngestConfig['d1']`, グローバル `fetch`
- Produces:
  - `type D1Row = Record<string, unknown>`
  - `type D1Result = { success: boolean; meta: { changes: number; last_row_id: number | null }; results: D1Row[] }`
  - `class D1Client { constructor(cfg: IngestConfig['d1'], fetchImpl?: typeof fetch); async execute(sql: string, params?: unknown[]): Promise<D1Result>; async batch(stmts: readonly { sql: string; params?: unknown[] }[]): Promise<D1Result[]>; }`
  - `execute` は単一 SQL を叩く。`batch` は複数 SQL を Cloudflare の `batch` エンドポイント経由で送る
  - エラー時は `D1Error` を throw（status + Cloudflare が返す errors 配列）

- [ ] **Step 1: テストを書く**

`tools/ingest/tests/d1.test.ts`:

```ts
import { describe, expect, test, vi } from 'vitest';
import { D1Client, D1Error } from '../src/d1.ts';

const cfg = { apiToken: 'tok', accountId: 'acct', databaseId: 'db' };

const jsonRes = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

describe('D1Client.execute', () => {
  test('POSTs SQL to the query endpoint with the bearer token', async () => {
    const fetchFn = vi.fn(async () =>
      jsonRes({
        success: true,
        result: [
          {
            success: true,
            meta: { changes: 1, last_row_id: 42 },
            results: [{ id: 42 }],
          },
        ],
      }),
    );
    const client = new D1Client(cfg, fetchFn);
    const result = await client.execute('SELECT id FROM icons WHERE name = ?', ['home']);
    expect(result.meta.changes).toBe(1);
    expect(result.results[0]).toEqual({ id: 42 });
    const call = fetchFn.mock.calls[0];
    const url = call?.[0] as string;
    const init = call?.[1] as RequestInit;
    expect(url).toContain('/accounts/acct/d1/database/db/query');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    expect(init.method).toBe('POST');
  });

  test('throws D1Error when Cloudflare reports failure', async () => {
    const fetchFn = vi.fn(async () =>
      jsonRes(
        {
          success: false,
          errors: [{ code: 7500, message: 'syntax error' }],
        },
        400,
      ),
    );
    const client = new D1Client(cfg, fetchFn);
    await expect(client.execute('BOOM')).rejects.toBeInstanceOf(D1Error);
  });
});

describe('D1Client.batch', () => {
  test('POSTs multiple statements to the /batch endpoint', async () => {
    const fetchFn = vi.fn(async () =>
      jsonRes({
        success: true,
        result: [
          { success: true, meta: { changes: 1, last_row_id: null }, results: [] },
          { success: true, meta: { changes: 2, last_row_id: null }, results: [] },
        ],
      }),
    );
    const client = new D1Client(cfg, fetchFn);
    const results = await client.batch([
      { sql: 'DELETE FROM icons WHERE collection = ?', params: ['mdi'] },
      { sql: 'INSERT INTO icons (collection, name) VALUES (?, ?)', params: ['mdi', 'home'] },
    ]);
    expect(results).toHaveLength(2);
    expect(results[1]?.meta.changes).toBe(2);
    const url = fetchFn.mock.calls[0]?.[0] as string;
    expect(url).toContain('/query'); // Cloudflare uses /query with sql array for batch
  });
});
```

- [ ] **Step 2: RED 確認**

Run: `pnpm -F @icon-collection/ingest test`
Expected: FAIL

- [ ] **Step 3: `tools/ingest/src/d1.ts` を実装**

Cloudflare D1 の HTTP API は `POST /accounts/{account_id}/d1/database/{database_id}/query` に `{ sql, params }` を送ると単一クエリ、`{ sql: [...], params: [...] }` の配列で batch という仕様。ただし公式 REST では `raw` エンドポイントもある。ここでは単純化して `execute` は 1 クエリを 1 リクエストで送り、`batch` は複数クエリを serialized に `execute` する（1 リクエスト = 1 SQL）。理由: バッチ順序保証を明示的に扱うため。将来 D1 の batch endpoint を使う最適化は別 Task で。

```ts
import type { IngestConfig } from './types.ts';

export type D1Row = Record<string, unknown>;

export type D1Result = {
  success: boolean;
  meta: { changes: number; last_row_id: number | null };
  results: D1Row[];
};

type D1Response = {
  success: boolean;
  result?: Array<{
    success: boolean;
    meta: { changes: number; last_row_id: number | null };
    results: D1Row[];
  }>;
  errors?: Array<{ code: number; message: string }>;
};

export class D1Error extends Error {
  readonly status: number;
  readonly errors: readonly { code: number; message: string }[];
  constructor(input: { status: number; errors: readonly { code: number; message: string }[] }) {
    super(`D1 request failed: status=${input.status} ${JSON.stringify(input.errors)}`);
    this.name = 'D1Error';
    this.status = input.status;
    this.errors = input.errors;
  }
}

export class D1Client {
  private readonly cfg: IngestConfig['d1'];
  private readonly fetchImpl: typeof fetch;
  private readonly endpoint: string;

  constructor(cfg: IngestConfig['d1'], fetchImpl?: typeof fetch) {
    this.cfg = cfg;
    this.fetchImpl = fetchImpl ?? globalThis.fetch;
    this.endpoint = `https://api.cloudflare.com/client/v4/accounts/${cfg.accountId}/d1/database/${cfg.databaseId}/query`;
  }

  async execute(sql: string, params?: readonly unknown[]): Promise<D1Result> {
    const res = await this.fetchImpl(this.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.cfg.apiToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ sql, params: params ?? [] }),
    });
    const body = (await res.json()) as D1Response;
    if (!res.ok || !body.success) {
      throw new D1Error({
        status: res.status,
        errors: body.errors ?? [{ code: -1, message: 'unknown' }],
      });
    }
    const first = body.result?.[0];
    if (!first) {
      throw new D1Error({
        status: res.status,
        errors: [{ code: -2, message: 'missing result' }],
      });
    }
    return first;
  }

  async batch(
    stmts: readonly { sql: string; params?: readonly unknown[] }[],
  ): Promise<D1Result[]> {
    const results: D1Result[] = [];
    for (const stmt of stmts) {
      results.push(await this.execute(stmt.sql, stmt.params));
    }
    return results;
  }
}
```

- [ ] **Step 4: GREEN 確認**

Run: `pnpm -F @icon-collection/ingest test`
Expected: PASS

- [ ] **Step 5: lint + typecheck**

Run: `pnpm lint && pnpm typecheck`
Expected: 成功

- [ ] **Step 6: コミット**

```bash
git add tools/ingest/src/d1.ts tools/ingest/tests/d1.test.ts
git commit -m "feat(ingest): add D1 HTTP client with execute and batch"
```

---

### Task 8: `schema.sql` と schema migration

**Files:**
- Create: `tools/ingest/src/schema.sql`
- Create: `tools/ingest/src/schema.ts`
- Create: `tools/ingest/tests/schema.test.ts`

**Interfaces:**
- Consumes: `D1Client`
- Produces:
  - `schema.sql` の内容: `icons`, `icons_fts`, `synonyms`, `collection_meta` の `CREATE TABLE IF NOT EXISTS` 系
  - `applySchema(d1: D1Client): Promise<void>` — schema.sql の各ステートメントを順次 execute
  - `SCHEMA_STATEMENTS: readonly string[]` — schema.sql を semicolon 単位で split した結果を export（テストで参照するため）

- [ ] **Step 1: `tools/ingest/src/schema.sql` を作成**

```sql
CREATE TABLE IF NOT EXISTS icons (
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

CREATE INDEX IF NOT EXISTS idx_icons_collection ON icons(collection);

CREATE VIRTUAL TABLE IF NOT EXISTS icons_fts USING fts5(
  name, aliases, tags, categories, collection UNINDEXED,
  content='icons', content_rowid='id',
  tokenize='unicode61 remove_diacritics 2'
);

CREATE TABLE IF NOT EXISTS synonyms (
  term      TEXT NOT NULL,
  expansion TEXT NOT NULL,
  lang      TEXT NOT NULL,
  weight    REAL NOT NULL DEFAULT 1.0,
  PRIMARY KEY(term, expansion, lang)
);

CREATE TABLE IF NOT EXISTS collection_meta (
  collection TEXT PRIMARY KEY,
  version    TEXT NOT NULL,
  license    TEXT NOT NULL,
  total      INTEGER NOT NULL,
  synced_at  INTEGER NOT NULL
);
```

- [ ] **Step 2: テストを書く**

`tools/ingest/tests/schema.test.ts`:

```ts
import { describe, expect, test, vi } from 'vitest';
import { D1Client } from '../src/d1.ts';
import { applySchema, SCHEMA_STATEMENTS } from '../src/schema.ts';

describe('SCHEMA_STATEMENTS', () => {
  test('contains create statements for icons, icons_fts, synonyms, collection_meta', () => {
    const joined = SCHEMA_STATEMENTS.join('\n');
    expect(joined).toMatch(/CREATE TABLE IF NOT EXISTS icons\b/);
    expect(joined).toMatch(/CREATE VIRTUAL TABLE IF NOT EXISTS icons_fts/);
    expect(joined).toMatch(/CREATE TABLE IF NOT EXISTS synonyms/);
    expect(joined).toMatch(/CREATE TABLE IF NOT EXISTS collection_meta/);
    expect(SCHEMA_STATEMENTS.length).toBeGreaterThanOrEqual(5);
  });

  test('each statement ends without a trailing semicolon', () => {
    for (const stmt of SCHEMA_STATEMENTS) {
      expect(stmt.trim().endsWith(';')).toBe(false);
    }
  });
});

describe('applySchema', () => {
  test('executes every statement against the D1 client', async () => {
    const execute = vi.fn(async () => ({
      success: true,
      meta: { changes: 0, last_row_id: null },
      results: [],
    }));
    const client = { execute } as unknown as D1Client;
    await applySchema(client);
    expect(execute).toHaveBeenCalledTimes(SCHEMA_STATEMENTS.length);
  });
});
```

- [ ] **Step 3: RED 確認**

Run: `pnpm -F @icon-collection/ingest test`
Expected: FAIL

- [ ] **Step 4: `tools/ingest/src/schema.ts` を実装**

```ts
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { D1Client } from './d1.ts';

const schemaPath = fileURLToPath(new URL('./schema.sql', import.meta.url));
const raw = await readFile(schemaPath, 'utf-8');

export const SCHEMA_STATEMENTS: readonly string[] = raw
  .split(/;\s*(?=CREATE|DROP|ALTER|BEGIN|END)/i)
  .map((s) => s.replace(/;\s*$/, '').trim())
  .filter((s) => s.length > 0);

export const applySchema = async (d1: D1Client): Promise<void> => {
  for (const stmt of SCHEMA_STATEMENTS) {
    await d1.execute(stmt);
  }
};
```

TLA (top-level await) が使えるのは `type: "module"` かつ `moduleResolution: Bundler` の場合。`vitest` は Node ESM で TLA をサポートするので問題ない。もし失敗するようなら `getSchemaStatements(): Promise<readonly string[]>` に切り替えて applySchema 内で await する。

- [ ] **Step 5: GREEN 確認**

Run: `pnpm -F @icon-collection/ingest test`
Expected: PASS

- [ ] **Step 6: lint + typecheck**

Run: `pnpm lint && pnpm typecheck`
Expected: 成功

- [ ] **Step 7: コミット**

```bash
git add tools/ingest/src/schema.sql tools/ingest/src/schema.ts tools/ingest/tests/schema.test.ts
git commit -m "feat(ingest): D1 schema for icons, icons_fts, synonyms, collection_meta"
```

---

### Task 9: `seed-d1` の icons テーブル置換

**Files:**
- Create: `tools/ingest/src/seed-icons.ts`
- Create: `tools/ingest/tests/seed-icons.test.ts`

**Interfaces:**
- Consumes: `D1Client`, `CollectionSnapshot`
- Produces:
  - `seedIcons(input: { d1: D1Client; snapshots: readonly CollectionSnapshot[]; batchSize?: number }): Promise<{ deleted: number; inserted: number }>`
  - collection 単位で `DELETE FROM icons WHERE collection = ?` → `INSERT INTO icons (...) VALUES (?, ?, ?, ?, ?, ?, ?, ?)` を 500 行 (default) バッチで実行
  - `aliases`, `tags`, `categories` は Iconify の `body.icons[name].aliases` や `body.categories` を optional に取り、CSV 文字列にする（未定義なら `null`）

- [ ] **Step 1: テストを書く**

`tools/ingest/tests/seed-icons.test.ts`:

```ts
import { describe, expect, test, vi } from 'vitest';
import { D1Client } from '../src/d1.ts';
import { seedIcons } from '../src/seed-icons.ts';
import type { CollectionSnapshot } from '../src/types.ts';

const snap = (): CollectionSnapshot => ({
  collection: 'mdi',
  version: '2.2.400',
  license: 'Apache-2.0',
  total: 3,
  body: {
    prefix: 'mdi',
    icons: {
      home: { body: '<path/>' },
      account: { body: '<path/>' },
      search: { body: '<path/>' },
    },
    aliases: {
      house: { parent: 'home' },
    },
    categories: {
      Navigation: ['home'],
      People: ['account'],
    },
  } as CollectionSnapshot['body'],
});

const okResult = { success: true, meta: { changes: 0, last_row_id: null }, results: [] };

describe('seedIcons', () => {
  test('deletes then inserts icons for each collection', async () => {
    const execute = vi.fn(async () => okResult);
    const client = { execute } as unknown as D1Client;
    const result = await seedIcons({ d1: client, snapshots: [snap()] });
    expect(result.deleted).toBe(1);
    expect(result.inserted).toBe(3);
    const sqlCalls = execute.mock.calls.map(([sql]) => sql as string);
    expect(sqlCalls.some((s) => s.startsWith('DELETE FROM icons'))).toBe(true);
    expect(sqlCalls.some((s) => s.startsWith('INSERT INTO icons'))).toBe(true);
  });

  test('splits large collections into batches of batchSize rows', async () => {
    const execute = vi.fn(async () => okResult);
    const client = { execute } as unknown as D1Client;
    const icons: Record<string, { body: string }> = {};
    for (let i = 0; i < 1200; i++) icons[`i${i}`] = { body: '<path/>' };
    const big: CollectionSnapshot = {
      collection: 'big',
      version: '1',
      license: 'MIT',
      total: 1200,
      body: { prefix: 'big', icons } as CollectionSnapshot['body'],
    };
    await seedIcons({ d1: client, snapshots: [big], batchSize: 500 });
    const inserts = execute.mock.calls.filter(([sql]) => (sql as string).startsWith('INSERT INTO icons'));
    // 1200 / 500 = 3 batches
    expect(inserts.length).toBe(3);
  });

  test('encodes categories and aliases as CSV strings, or null when absent', async () => {
    const execute = vi.fn(async () => okResult);
    const client = { execute } as unknown as D1Client;
    await seedIcons({ d1: client, snapshots: [snap()] });
    const inserts = execute.mock.calls
      .filter(([sql]) => (sql as string).startsWith('INSERT INTO icons'))
      .flatMap(([, params]) => params as unknown[]);
    // parameter layout per row: collection, name, license, categories, tags, aliases, updated_at
    const home = inserts.slice(0, 7);
    expect(home[0]).toBe('mdi');
    expect(home[1]).toBe('home');
    expect(home[3]).toBe('Navigation');
    expect(home[5]).toBe('house');
    const account = inserts.slice(7, 14);
    expect(account[3]).toBe('People');
    expect(account[5]).toBeNull();
  });
});
```

- [ ] **Step 2: RED 確認**

Run: `pnpm -F @icon-collection/ingest test`
Expected: FAIL

- [ ] **Step 3: `tools/ingest/src/seed-icons.ts` を実装**

```ts
import type { D1Client } from './d1.ts';
import type { CollectionSnapshot, IconifyJSON } from './types.ts';

const DEFAULT_BATCH_SIZE = 500;

type IconMeta = {
  categories: string | null;
  tags: string | null;
  aliases: string | null;
};

const buildIndex = (body: IconifyJSON): Map<string, IconMeta> => {
  const index = new Map<string, IconMeta>();
  for (const name of Object.keys(body.icons)) {
    index.set(name, { categories: null, tags: null, aliases: null });
  }
  const cats = (body as { categories?: Record<string, string[]> }).categories;
  if (cats) {
    for (const [category, names] of Object.entries(cats)) {
      for (const name of names) {
        const meta = index.get(name);
        if (!meta) continue;
        meta.categories = meta.categories ? `${meta.categories},${category}` : category;
      }
    }
  }
  const aliases = (body as { aliases?: Record<string, { parent?: string }> }).aliases;
  if (aliases) {
    for (const [alias, def] of Object.entries(aliases)) {
      const parent = def.parent;
      if (!parent) continue;
      const meta = index.get(parent);
      if (!meta) continue;
      meta.aliases = meta.aliases ? `${meta.aliases},${alias}` : alias;
    }
  }
  return index;
};

const buildInsertSql = (rowCount: number): string => {
  const placeholders = Array.from({ length: rowCount }, () => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
  return `INSERT INTO icons (collection, name, license, categories, tags, aliases, updated_at) VALUES ${placeholders}`;
};

export type SeedIconsInput = {
  d1: D1Client;
  snapshots: readonly CollectionSnapshot[];
  batchSize?: number;
};

export const seedIcons = async (
  input: SeedIconsInput,
): Promise<{ deleted: number; inserted: number }> => {
  const batchSize = input.batchSize ?? DEFAULT_BATCH_SIZE;
  let deleted = 0;
  let inserted = 0;
  for (const snap of input.snapshots) {
    await input.d1.execute('DELETE FROM icons WHERE collection = ?', [snap.collection]);
    deleted++;
    const index = buildIndex(snap.body);
    const names = Object.keys(snap.body.icons);
    const updatedAt = Math.floor(Date.now() / 1000);
    for (let offset = 0; offset < names.length; offset += batchSize) {
      const chunk = names.slice(offset, offset + batchSize);
      const params: unknown[] = [];
      for (const name of chunk) {
        const meta = index.get(name);
        params.push(
          snap.collection,
          name,
          snap.license,
          meta?.categories ?? null,
          meta?.tags ?? null,
          meta?.aliases ?? null,
          updatedAt,
        );
      }
      await input.d1.execute(buildInsertSql(chunk.length), params);
      inserted += chunk.length;
    }
  }
  return { deleted, inserted };
};
```

- [ ] **Step 4: GREEN 確認**

Run: `pnpm -F @icon-collection/ingest test`
Expected: PASS

- [ ] **Step 5: lint + typecheck**

Run: `pnpm lint && pnpm typecheck`
Expected: 成功

- [ ] **Step 6: コミット**

```bash
git add tools/ingest/src/seed-icons.ts tools/ingest/tests/seed-icons.test.ts
git commit -m "feat(ingest): replace icons per collection in 500-row batches"
```

---

### Task 10: `seed-d1` の synonyms と collection_meta

**Files:**
- Create: `tools/ingest/src/seed-synonyms.ts`
- Create: `tools/ingest/src/seed-meta.ts`
- Create: `tools/ingest/tests/seed-synonyms.test.ts`
- Create: `tools/ingest/tests/seed-meta.test.ts`
- Modify: `tools/ingest/package.json` (`@icon-collection/synonyms` を workspace 依存に追加)

**Interfaces:**
- Consumes: `D1Client`, `@icon-collection/synonyms` (`loadDictionary`, `SynonymDictionary`), `CollectionSnapshot`
- Produces:
  - `seedSynonyms(input: { d1: D1Client; dictionaries?: readonly SynonymDictionary[]; batchSize?: number }): Promise<{ inserted: number }>`
    - `dictionaries` 省略時は `loadDictionary('ja')` + `loadDictionary('en')` を結合
    - 常に `DELETE FROM synonyms` してから再投入（辞書は小さいので全消し全入れで安全）
  - `seedCollectionMeta(input: { d1: D1Client; snapshots: readonly CollectionSnapshot[] }): Promise<{ upserted: number }>`
    - `INSERT INTO collection_meta ... ON CONFLICT(collection) DO UPDATE SET ...`

- [ ] **Step 1: 依存を追加**

```bash
pnpm -F @icon-collection/ingest add @icon-collection/synonyms@workspace:*
```

- [ ] **Step 2: `seed-synonyms.test.ts` を書く**

```ts
import { describe, expect, test, vi } from 'vitest';
import type { D1Client } from '../src/d1.ts';
import { seedSynonyms } from '../src/seed-synonyms.ts';
import type { SynonymDictionary } from '@icon-collection/synonyms';

const ok = { success: true, meta: { changes: 0, last_row_id: null }, results: [] };

describe('seedSynonyms', () => {
  test('deletes all synonyms then inserts merged dictionaries', async () => {
    const execute = vi.fn(async () => ok);
    const client = { execute } as unknown as D1Client;
    const dict: SynonymDictionary = [
      { term: 'home', expansion: 'house', lang: 'en' },
      { term: 'カート', expansion: 'cart', lang: 'ja' },
    ];
    const result = await seedSynonyms({ d1: client, dictionaries: [dict] });
    expect(result.inserted).toBe(2);
    const sqlCalls = execute.mock.calls.map(([sql]) => sql as string);
    expect(sqlCalls[0]).toBe('DELETE FROM synonyms');
    expect(sqlCalls[1]?.startsWith('INSERT INTO synonyms')).toBe(true);
  });

  test('uses default dictionaries when none provided (packages/synonyms)', async () => {
    const execute = vi.fn(async () => ok);
    const client = { execute } as unknown as D1Client;
    const result = await seedSynonyms({ d1: client });
    expect(result.inserted).toBeGreaterThan(0);
  });

  test('batches inserts by batchSize', async () => {
    const execute = vi.fn(async () => ok);
    const client = { execute } as unknown as D1Client;
    const dict: SynonymDictionary = Array.from({ length: 250 }, (_, i) => ({
      term: `t${i}`,
      expansion: `e${i}`,
      lang: 'en' as const,
    }));
    await seedSynonyms({ d1: client, dictionaries: [dict], batchSize: 100 });
    const inserts = execute.mock.calls.filter(([sql]) =>
      (sql as string).startsWith('INSERT INTO synonyms'),
    );
    // 250 / 100 = 3 batches (100 + 100 + 50)
    expect(inserts.length).toBe(3);
  });
});
```

- [ ] **Step 3: `seed-meta.test.ts` を書く**

```ts
import { describe, expect, test, vi } from 'vitest';
import type { D1Client } from '../src/d1.ts';
import { seedCollectionMeta } from '../src/seed-meta.ts';
import type { CollectionSnapshot } from '../src/types.ts';

const ok = { success: true, meta: { changes: 1, last_row_id: null }, results: [] };

const snap = (collection: string): CollectionSnapshot => ({
  collection,
  version: '2.2.400',
  license: 'MIT',
  total: 10,
  body: { prefix: collection, icons: {} } as CollectionSnapshot['body'],
});

describe('seedCollectionMeta', () => {
  test('upserts one row per snapshot via ON CONFLICT clause', async () => {
    const execute = vi.fn(async () => ok);
    const client = { execute } as unknown as D1Client;
    const result = await seedCollectionMeta({
      d1: client,
      snapshots: [snap('mdi'), snap('lucide')],
    });
    expect(result.upserted).toBe(2);
    const sql = execute.mock.calls[0]?.[0] as string;
    expect(sql).toMatch(/INSERT INTO collection_meta/);
    expect(sql).toMatch(/ON CONFLICT\(collection\) DO UPDATE/);
  });

  test('passes collection, version, license, total, and synced_at as params', async () => {
    const execute = vi.fn(async () => ok);
    const client = { execute } as unknown as D1Client;
    await seedCollectionMeta({ d1: client, snapshots: [snap('mdi')] });
    const params = execute.mock.calls[0]?.[1] as unknown[];
    expect(params[0]).toBe('mdi');
    expect(params[1]).toBe('2.2.400');
    expect(params[2]).toBe('MIT');
    expect(params[3]).toBe(10);
    expect(typeof params[4]).toBe('number');
  });
});
```

- [ ] **Step 4: RED 確認**

Run: `pnpm -F @icon-collection/ingest test`
Expected: FAIL

- [ ] **Step 5: `tools/ingest/src/seed-synonyms.ts` を実装**

```ts
import { loadDictionary, type SynonymDictionary } from '@icon-collection/synonyms';
import type { D1Client } from './d1.ts';

const DEFAULT_BATCH_SIZE = 500;

const buildInsertSql = (rowCount: number): string => {
  const placeholders = Array.from({ length: rowCount }, () => '(?, ?, ?, ?)').join(', ');
  return `INSERT INTO synonyms (term, expansion, lang, weight) VALUES ${placeholders}`;
};

export type SeedSynonymsInput = {
  d1: D1Client;
  dictionaries?: readonly SynonymDictionary[];
  batchSize?: number;
};

export const seedSynonyms = async (
  input: SeedSynonymsInput,
): Promise<{ inserted: number }> => {
  const batchSize = input.batchSize ?? DEFAULT_BATCH_SIZE;
  const dicts = input.dictionaries ?? [loadDictionary('ja'), loadDictionary('en')];
  const entries = dicts.flatMap((d) => Array.from(d));
  await input.d1.execute('DELETE FROM synonyms');
  let inserted = 0;
  for (let offset = 0; offset < entries.length; offset += batchSize) {
    const chunk = entries.slice(offset, offset + batchSize);
    const params: unknown[] = [];
    for (const entry of chunk) {
      params.push(entry.term, entry.expansion, entry.lang, entry.weight ?? 1.0);
    }
    await input.d1.execute(buildInsertSql(chunk.length), params);
    inserted += chunk.length;
  }
  return { inserted };
};
```

- [ ] **Step 6: `tools/ingest/src/seed-meta.ts` を実装**

```ts
import type { D1Client } from './d1.ts';
import type { CollectionSnapshot } from './types.ts';

export type SeedMetaInput = {
  d1: D1Client;
  snapshots: readonly CollectionSnapshot[];
};

export const seedCollectionMeta = async (
  input: SeedMetaInput,
): Promise<{ upserted: number }> => {
  const sql = `INSERT INTO collection_meta (collection, version, license, total, synced_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(collection) DO UPDATE SET version = excluded.version, license = excluded.license, total = excluded.total, synced_at = excluded.synced_at`;
  const now = Math.floor(Date.now() / 1000);
  let upserted = 0;
  for (const snap of input.snapshots) {
    await input.d1.execute(sql, [
      snap.collection,
      snap.version,
      snap.license,
      snap.total,
      now,
    ]);
    upserted++;
  }
  return { upserted };
};
```

- [ ] **Step 7: GREEN 確認**

Run: `pnpm -F @icon-collection/ingest test`
Expected: PASS

- [ ] **Step 8: lint + typecheck**

Run: `pnpm lint && pnpm typecheck`
Expected: 成功

- [ ] **Step 9: コミット**

```bash
git add tools/ingest/src/seed-synonyms.ts tools/ingest/src/seed-meta.ts tools/ingest/tests/seed-synonyms.test.ts tools/ingest/tests/seed-meta.test.ts tools/ingest/package.json pnpm-lock.yaml
git commit -m "feat(ingest): seed synonyms and collection_meta into D1"
```

---

### Task 11: `seed-d1` の FTS5 rebuild

**Files:**
- Create: `tools/ingest/src/seed-fts.ts`
- Create: `tools/ingest/tests/seed-fts.test.ts`

**Interfaces:**
- Consumes: `D1Client`
- Produces:
  - `rebuildFts(d1: D1Client): Promise<void>` — `INSERT INTO icons_fts(icons_fts) VALUES('rebuild')` を実行

- [ ] **Step 1: テストを書く**

`tools/ingest/tests/seed-fts.test.ts`:

```ts
import { describe, expect, test, vi } from 'vitest';
import type { D1Client } from '../src/d1.ts';
import { rebuildFts } from '../src/seed-fts.ts';

const ok = { success: true, meta: { changes: 0, last_row_id: null }, results: [] };

describe('rebuildFts', () => {
  test('runs the FTS5 rebuild pragma', async () => {
    const execute = vi.fn(async () => ok);
    const client = { execute } as unknown as D1Client;
    await rebuildFts(client);
    const sql = execute.mock.calls[0]?.[0] as string;
    expect(sql).toBe("INSERT INTO icons_fts(icons_fts) VALUES('rebuild')");
  });
});
```

- [ ] **Step 2: RED 確認**

Run: `pnpm -F @icon-collection/ingest test`
Expected: FAIL

- [ ] **Step 3: `tools/ingest/src/seed-fts.ts` を実装**

```ts
import type { D1Client } from './d1.ts';

export const rebuildFts = async (d1: D1Client): Promise<void> => {
  await d1.execute("INSERT INTO icons_fts(icons_fts) VALUES('rebuild')");
};
```

- [ ] **Step 4: GREEN 確認**

Run: `pnpm -F @icon-collection/ingest test`
Expected: PASS

- [ ] **Step 5: lint + typecheck**

Run: `pnpm lint && pnpm typecheck`
Expected: 成功

- [ ] **Step 6: コミット**

```bash
git add tools/ingest/src/seed-fts.ts tools/ingest/tests/seed-fts.test.ts
git commit -m "feat(ingest): rebuild icons_fts index after seeding"
```

---

### Task 12: `run.ts` — orchestration + structured log

**Files:**
- Create: `tools/ingest/src/run.ts`
- Modify: `tools/ingest/src/index.ts` (CLI entry から `run` を呼ぶ)
- Create: `tools/ingest/tests/run.test.ts`

**Interfaces:**
- Consumes: `loadConfig`, `readIconifyVersion`, `detectChanges`, `collectFromIconify`, `R2Client`, `syncSnapshotsToR2`, `D1Client`, `applySchema`, `seedIcons`, `seedSynonyms`, `seedCollectionMeta`, `rebuildFts`, `IngestReport`
- Produces:
  - `run(config: IngestConfig, deps?: RunDeps): Promise<IngestReport>` — 全段の orchestration
  - `RunDeps = { r2?: R2Client; d1?: D1Client; readVersion?: () => Promise<string>; collect?: (collection: string, version: string) => Promise<CollectionSnapshot> }` — 全てオプショナル、テストで差し込む
  - CLI `main()` は `loadConfig(process.env)` → `run(config)` を呼び、`IngestReport` を stdout に JSON で出す
  - 何も変更がなければ D1 の schema apply だけ実行して early return し、report の `d1RowsInserted = 0` / `collectionsChanged = []` を返す

- [ ] **Step 1: テストを書く**

`tools/ingest/tests/run.test.ts`:

```ts
import { describe, expect, test, vi } from 'vitest';
import { fileURLToPath } from 'node:url';
import { collectFromPath } from '../src/collect.ts';
import type { D1Client } from '../src/d1.ts';
import type { R2Client } from '../src/r2.ts';
import { run } from '../src/run.ts';
import type { IngestConfig } from '../src/types.ts';

const fixturePath = (name: string): string =>
  fileURLToPath(new URL(`../__fixtures__/${name}`, import.meta.url));

const baseConfig: IngestConfig = {
  r2: { accountId: 'acct', accessKeyId: 'k', secretAccessKey: 's', bucket: 'b' },
  d1: { apiToken: 't', accountId: 'acct', databaseId: 'db' },
  collections: ['mdi', 'lucide'],
  dryRun: false,
};

const okResult = { success: true, meta: { changes: 0, last_row_id: null }, results: [] };

describe('run', () => {
  test('performs detect -> collect -> sync-r2 -> seed-d1 and returns a report', async () => {
    const r2 = {
      putJson: vi.fn(async () => ({ changed: true, sha256: 'x' })),
      getJson: vi.fn(async () => null),
    } as unknown as R2Client;
    const d1 = { execute: vi.fn(async () => okResult) } as unknown as D1Client;
    const report = await run(baseConfig, {
      r2,
      d1,
      readVersion: async () => '2.2.500',
      collect: async (collection, version) =>
        collectFromPath(fixturePath(`${collection}-mini.json`), version),
    });
    expect(report.collectionsChecked).toBe(2);
    expect(report.collectionsChanged.sort()).toEqual(['lucide', 'mdi']);
    expect(report.d1RowsInserted).toBe(5); // 3 mdi + 2 lucide
    expect(report.ftsRebuilt).toBe(true);
    expect(report.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(report.finishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test('when storedVersions matches current, skips collect/sync and returns empty change list', async () => {
    const r2 = {
      putJson: vi.fn(async () => ({ changed: true, sha256: 'x' })),
      getJson: vi.fn(async (key: string) =>
        key === 'meta/version.json' ? { mdi: '2.2.500', lucide: '2.2.500' } : null,
      ),
    } as unknown as R2Client;
    const d1 = { execute: vi.fn(async () => okResult) } as unknown as D1Client;
    const collectSpy = vi.fn();
    const report = await run(baseConfig, {
      r2,
      d1,
      readVersion: async () => '2.2.500',
      collect: async (c, v) => {
        collectSpy(c, v);
        return collectFromPath(fixturePath(`${c}-mini.json`), v);
      },
    });
    expect(report.collectionsChanged).toEqual([]);
    expect(collectSpy).not.toHaveBeenCalled();
    expect(report.ftsRebuilt).toBe(false);
  });

  test('dryRun does not call D1 execute for inserts', async () => {
    const executed: string[] = [];
    const d1 = {
      execute: vi.fn(async (sql: string) => {
        executed.push(sql);
        return okResult;
      }),
    } as unknown as D1Client;
    const r2 = {
      putJson: vi.fn(async () => ({ changed: true, sha256: 'x' })),
      getJson: vi.fn(async () => null),
    } as unknown as R2Client;
    await run(
      { ...baseConfig, dryRun: true },
      {
        r2,
        d1,
        readVersion: async () => '2.2.500',
        collect: async (c, v) => collectFromPath(fixturePath(`${c}-mini.json`), v),
      },
    );
    // schema apply may still run, but no INSERT INTO icons
    expect(executed.some((s) => s.startsWith('INSERT INTO icons '))).toBe(false);
    expect(executed.some((s) => s.startsWith('DELETE FROM icons'))).toBe(false);
  });
});
```

- [ ] **Step 2: RED 確認**

Run: `pnpm -F @icon-collection/ingest test`
Expected: FAIL

- [ ] **Step 3: `tools/ingest/src/run.ts` を実装**

```ts
import { collectFromIconify } from './collect.ts';
import { D1Client } from './d1.ts';
import { detectChanges, readIconifyVersion } from './detect.ts';
import { R2Client } from './r2.ts';
import { applySchema } from './schema.ts';
import { rebuildFts } from './seed-fts.ts';
import { seedIcons } from './seed-icons.ts';
import { seedCollectionMeta } from './seed-meta.ts';
import { seedSynonyms } from './seed-synonyms.ts';
import { syncSnapshotsToR2 } from './sync-r2.ts';
import type { CollectionSnapshot, IngestConfig, IngestReport } from './types.ts';

export type RunDeps = {
  r2?: R2Client;
  d1?: D1Client;
  readVersion?: () => Promise<string>;
  collect?: (collection: string, version: string) => Promise<CollectionSnapshot>;
};

export const run = async (config: IngestConfig, deps: RunDeps = {}): Promise<IngestReport> => {
  const startedAt = new Date().toISOString();
  const r2 = deps.r2 ?? new R2Client(config.r2);
  const d1 = deps.d1 ?? new D1Client(config.d1);
  const readVersion = deps.readVersion ?? readIconifyVersion;
  const collect = deps.collect ?? collectFromIconify;

  await applySchema(d1);

  const currentVersion = await readVersion();
  const storedVersions =
    (await r2.getJson<Record<string, string>>('meta/version.json')) ?? {};
  const { changed, nextVersions } = detectChanges({
    collections: config.collections,
    currentVersion,
    storedVersions,
  });

  if (changed.length === 0) {
    return {
      collectionsChecked: config.collections.length,
      collectionsChanged: [],
      d1RowsInserted: 0,
      ftsRebuilt: false,
      startedAt,
      finishedAt: new Date().toISOString(),
    };
  }

  const snapshots: CollectionSnapshot[] = [];
  for (const collection of changed) {
    snapshots.push(await collect(collection, currentVersion));
  }

  await syncSnapshotsToR2({ r2, snapshots, dryRun: config.dryRun });
  await r2.putJson('meta/version.json', nextVersions);

  let d1RowsInserted = 0;
  let ftsRebuilt = false;
  if (!config.dryRun) {
    const iconsResult = await seedIcons({ d1, snapshots });
    d1RowsInserted += iconsResult.inserted;
    const synResult = await seedSynonyms({ d1 });
    d1RowsInserted += synResult.inserted;
    await seedCollectionMeta({ d1, snapshots });
    await rebuildFts(d1);
    ftsRebuilt = true;
  }

  return {
    collectionsChecked: config.collections.length,
    collectionsChanged: [...changed],
    d1RowsInserted,
    ftsRebuilt,
    startedAt,
    finishedAt: new Date().toISOString(),
  };
};
```

- [ ] **Step 4: `tools/ingest/src/index.ts` を更新**

```ts
import { loadConfig } from './config.ts';
import { run } from './run.ts';

export const main = async (): Promise<void> => {
  const config = loadConfig(process.env);
  const report = await run(config);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
};

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  await main();
}
```

- [ ] **Step 5: GREEN 確認**

Run: `pnpm -F @icon-collection/ingest test`
Expected: PASS

- [ ] **Step 6: lint + typecheck**

Run: `pnpm lint && pnpm typecheck`
Expected: 成功

- [ ] **Step 7: コミット**

```bash
git add tools/ingest/src/run.ts tools/ingest/src/index.ts tools/ingest/tests/run.test.ts
git commit -m "feat(ingest): orchestrate detect->collect->sync-r2->seed-d1"
```

---

### Task 13: GitHub Actions `ingest.yml`

**Files:**
- Create: `.github/workflows/ingest.yml`

**Interfaces:**
- Consumes: `pnpm`, `Node 22`, secrets `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `D1_DATABASE_ID`
- Produces: 週次 cron（毎週月曜 03:00 UTC）+ manual `workflow_dispatch`（`dry-run` input で dry-run 切り替え）で ingest を実行するワークフロー

- [ ] **Step 1: `.github/workflows/ingest.yml` を作成**

```yaml
name: ingest

on:
  schedule:
    - cron: '0 3 * * 1'
  workflow_dispatch:
    inputs:
      dry-run:
        description: 'Run without writing to D1'
        required: false
        default: 'false'
        type: choice
        options:
          - 'false'
          - 'true'

concurrency:
  group: ingest
  cancel-in-progress: false

jobs:
  ingest:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .node-version
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm -F @icon-collection/ingest start
        env:
          R2_ACCOUNT_ID: ${{ secrets.R2_ACCOUNT_ID }}
          R2_ACCESS_KEY_ID: ${{ secrets.R2_ACCESS_KEY_ID }}
          R2_SECRET_ACCESS_KEY: ${{ secrets.R2_SECRET_ACCESS_KEY }}
          R2_BUCKET: ${{ secrets.R2_BUCKET }}
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          D1_DATABASE_ID: ${{ secrets.D1_DATABASE_ID }}
          INGEST_DRY_RUN: ${{ inputs.dry-run == 'true' && '1' || '' }}
```

- [ ] **Step 2: 静的検証**

Run: `pnpm dlx @action-validator/cli .github/workflows/ingest.yml`
Expected: `OK`（もし失敗したらインデントを疑う）

- [ ] **Step 3: local で dry-run 相当のテストが通ることを確認**

Run: `pnpm lint && pnpm typecheck && pnpm test`
Expected: 全パッケージ green

- [ ] **Step 4: コミット**

```bash
git add .github/workflows/ingest.yml
git commit -m "ci: run ingest weekly and on manual dispatch"
```

---

### Task 14: README とプラン目次更新、PR 作成

**Files:**
- Create: `tools/ingest/README.md`
- Modify: なし（`docs/superpowers/plans/README.md` は Plan A のマージ時点で削除されている前提、復元しない）

**Interfaces:**
- Produces:
  - `tools/ingest/README.md`: 概要、環境変数、`pnpm start` の使い方、GitHub Actions の secrets 設定、Cloudflare 側で必要な事前設定（R2 バケット作成、D1 データベース作成 + API token 発行）

- [ ] **Step 1: `tools/ingest/README.md` を作成**

```markdown
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
5. `seedIcons` — collection 単位で `DELETE` + 500 行バッチ `INSERT`
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
```

- [ ] **Step 2: 最終確認**

Run: `pnpm lint && pnpm typecheck && pnpm test`
Expected: 全 green

- [ ] **Step 3: コミット**

```bash
git add tools/ingest/README.md
git commit -m "docs(ingest): document env, pipeline, and Cloudflare setup"
```

- [ ] **Step 4: push**

```bash
git push -u origin feat/revamp-ingest
```

- [ ] **Step 5: PR 作成**

```bash
gh pr create --title "feat: ingest pipeline (Plan B)" --body "$(cat <<'EOF'
## Summary
- `tools/ingest` パッケージで Iconify JSON を R2 に、検索メタデータを D1 (FTS5) に投入
- 週次 `ingest.yml` (cron + manual dispatch) を追加
- sha256 差分で R2 upload をスキップ、collection 単位で D1 を `DELETE` + 500 行バッチ `INSERT`、最後に FTS5 rebuild

## Scope
- 対象は Iconify の固定 15 collection
- React Icons 独自 collection は本 PR のスコープ外 (Plan B' で対応予定)

## Cloudflare 事前準備
- R2 バケット + S3 互換 API キー
- D1 データベース + D1 Edit 権限の API トークン
- 上記を GitHub secrets に登録

## Test plan
- [ ] `pnpm -F @icon-collection/ingest test` が全 PASS
- [ ] `pnpm lint` / `pnpm typecheck` が clean
- [ ] `INGEST_DRY_RUN=1` の手動 dispatch が exit 0 で完了
- [ ] Cloudflare secrets を設定後の本番 dispatch で `collectionsChanged` に 15 collection が並ぶ
EOF
)"
```

---

## Self-Review 結果

**1. Spec coverage:** Plan B のスコープ (`tools/ingest`, R2 sync, D1 seed, weekly cron) は Task 0–14 で全てカバー。React Icons は明示的にスコープ外として Plan B' に譲る旨を Global Constraints と PR body に記載。

**2. Placeholder scan:** 「TBD」「TODO」「implement later」の類は存在しない。各 Step にコード・コマンド・期待出力を verbatim で記載。

**3. Type consistency:**
- `IngestConfig` は Task 1 で定義、Task 2 が生成し、Task 5/7/12 が消費 — 全て同一シグネチャ
- `CollectionSnapshot` は Task 1 定義、Task 4/6/9/10/12 で consume — フィールド名（`collection`, `version`, `license`, `total`, `body`）一貫
- `R2Client` の `putJson` / `getJson` / `putIfChanged` は Task 5 定義、Task 6/12 が使用
- `D1Client` の `execute` / `batch` は Task 7 定義、Task 8/9/10/11/12 が `execute` を使用（`batch` は本プランでは serialized 実行にしているため未使用だが Interface としては存在）
- `IngestReport` は Task 1 定義、Task 12 が返す — フィールド一貫

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-25-ingest-pipeline.md`. 2 つの実行方式:

1. **Subagent-Driven（推奨）** — タスクごとに fresh subagent + review + progress ledger（Plan A と同方式）
2. **Inline Execution** — このセッションで `superpowers:executing-plans`

どちらで進めますか?
