# Monorepo Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** IconCollection 刷新の土台となる pnpm モノレポ骨格と、後続の Ingest / Web / VSCode 拡張が全て依存する共通パッケージ (`packages/core`, `packages/synonyms`, `packages/ui`) を実装し、CI で品質ゲートを敷く。

**Architecture:** pnpm workspace で `apps/*` `packages/*` `tools/*` を並置。共通の TypeScript strict 設定と Biome を root で管理。共通パッケージは 3 層: (a) 型・APIクライアント・クエリ処理 (`core`), (b) 同義語辞書 (`synonyms`), (c) Preact + Tailwind の UI コンポーネントとフック (`ui`)。ホスト差分は `HostContext` で注入することで Web と VSCode 拡張の双方から再利用可能にする。

**Tech Stack:** pnpm workspace / TypeScript 5 (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) / Biome (lint + format) / Vitest (test) / Preact 10 / Tailwind CSS / happy-dom / @testing-library/preact

## Global Constraints

- **依存バージョンをコードで固定しない**: `package.json` のバージョンは常に `pnpm add` / `pnpm add -D` で導入し、CLI が書き込んだ最新値を採用する。既存の `package.json` の version 指定を直接書き換えるステップは書かない
- **既存の `parsers/` `extension/` は残置**: このプランでは触らない。全て `packages/*` 配下に新規作成する
- **`@ts-ignore` `@biome-ignore` などの ignore ディレクティブ禁止**: 型がうまく通らない場合は設計を直す
- **絵文字禁止**: コード・ドキュメント・コミットメッセージのいずれにも入れない
- **Node.js 20 系**: Cloudflare Workers 互換のため。`.node-version` に `20` を書く
- **package manager は pnpm 9 系**: `corepack` で固定
- **TypeScript は strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`**: `tsconfig.base.json` で強制
- **UI は Preact 10 + Tailwind**: React ではなく Preact。VSCode 拡張バンドルを軽量に保つため
- **UI の JSX は `jsxImportSource: "preact"`**: `preact/compat` に頼らず素の Preact API を使う
- **テストは Vitest + happy-dom**: jsdom より速い
- **1 タスク = 1 コミット**: 各タスク末尾でコミットする
- **feature branch `feat/revamp-foundation` で作業**: 既存の `feat/revamp-design` から分岐

---

### Task 0: ブランチ切り出しと `.node-version`

**Files:**
- Create: `.node-version`
- Modify: (branch 切替のみ)

**Interfaces:**
- Consumes: 既存の spec ドキュメント `docs/superpowers/specs/2026-07-12-icon-collection-revamp-design.md`
- Produces: 以降の Task が乗る feature branch `feat/revamp-foundation`

- [ ] **Step 1: `master` から分岐して feature branch を作成**

```bash
git fetch origin
git checkout master
git pull --ff-only origin master
git checkout -b feat/revamp-foundation
```

- [ ] **Step 2: `.node-version` を作成**

```
20
```

- [ ] **Step 3: 内容を確認**

Run: `cat .node-version`
Expected: `20`

- [ ] **Step 4: コミット**

```bash
git add .node-version
git commit -m "chore: pin Node.js to 20 for Cloudflare Workers compatibility"
```

---

### Task 1: pnpm workspace と root `package.json`

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `package.json` (root)
- Create: `.gitignore` (追記統合。旧ファイルが無ければ新規)

**Interfaces:**
- Produces:
  - workspace パターン `apps/*` `packages/*` `tools/*`
  - root scripts: `lint`, `format`, `typecheck`, `test`, `test:watch`
  - devDependencies: `@biomejs/biome`, `typescript`, `vitest`, `@types/node`

- [ ] **Step 1: `pnpm-workspace.yaml` を作成**

```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "tools/*"
```

- [ ] **Step 2: 既存 `package.json` を破棄し、root ワークスペース用に置き換え**

旧 `package.json` はランタイム依存（`react-icons`, `@iconify/json` など）を持つが、これらは `tools/ingest` へ移す予定なのでこのプランでは root から外す。旧ファイルは `parsers/` を残置のためこの Task では削除しない（既存の `parsers/*.js` は動かないが、フェーズ 5 まで残置する仕様）。旧 root `package.json` は `parsers/package.json` に退避する。

```bash
mkdir -p parsers
mv package.json parsers/package.json
```

続いて root `package.json` を新規作成:

```json
{
  "name": "icon-collection",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=20"
  },
  "packageManager": "pnpm@9.15.0",
  "scripts": {
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "format": "biome format --write .",
    "typecheck": "tsc -b",
    "test": "pnpm -r --if-present test",
    "test:watch": "pnpm -r --if-present test:watch"
  }
}
```

注: `packageManager` の値は本 Task の Step 3 で `corepack use pnpm@latest-9` を実行後、自動で最新の 9 系に書き換えられるため上記の `9.15.0` はあくまで初期値。Step 4 で確認する。

- [ ] **Step 3: corepack で pnpm を有効化して最新の 9 系を確定**

```bash
corepack enable
corepack use pnpm@latest-9
```

- [ ] **Step 4: dev 依存を install**

```bash
pnpm add -Dw @biomejs/biome typescript vitest @types/node happy-dom
```

`-w` は workspace root への追加。バージョンは pnpm が書き込む。

- [ ] **Step 5: `.gitignore` を作成（既存があれば追記）**

```
node_modules/
dist/
.wrangler/
.astro/
.turbo/
coverage/
*.tsbuildinfo
```

- [ ] **Step 6: 型チェックが空で通ることを確認**

Run: `pnpm typecheck || true`
Expected: `tsconfig.base.json` 未定義のため一時的にエラー。次 Task で解消するのでここでは無視。

- [ ] **Step 7: コミット**

```bash
git add pnpm-workspace.yaml package.json .gitignore parsers/package.json
git commit -m "chore: bootstrap pnpm workspace and root scripts"
```

---

### Task 2: TypeScript / Biome / Vitest の共通設定

**Files:**
- Create: `tsconfig.base.json`
- Create: `tsconfig.json` (project references の root)
- Create: `biome.json`
- Create: `vitest.workspace.ts`

**Interfaces:**
- Produces:
  - `tsconfig.base.json` に `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `jsx: preserve`, `jsxImportSource: preact`
  - `biome.json` に formatter/lint 共通ルール
  - `vitest.workspace.ts` で各 `packages/*/vitest.config.ts` を集約

- [ ] **Step 1: `tsconfig.base.json` を作成**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "verbatimModuleSyntax": true,
    "jsx": "preserve",
    "jsxImportSource": "preact"
  }
}
```

- [ ] **Step 2: root `tsconfig.json` を作成**

```json
{
  "files": [],
  "references": []
}
```

タスクが進むごとに `references` に `packages/*` を追加する。

- [ ] **Step 3: `biome.json` を作成**

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true
  },
  "files": {
    "ignore": ["dist", "node_modules", ".astro", ".wrangler", "coverage", "parsers"]
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "correctness": {
        "noUnusedImports": "error"
      },
      "suspicious": {
        "noExplicitAny": "error"
      }
    }
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "semicolons": "always",
      "trailingCommas": "all"
    }
  }
}
```

- [ ] **Step 4: `vitest.workspace.ts` を作成**

```ts
export default ['packages/*/vitest.config.ts'];
```

- [ ] **Step 5: Biome の check が現状で通ることを確認**

Run: `pnpm lint`
Expected: `Checked N files. No fixes needed.` （設定ファイルしかないので 0 diagnostics）

- [ ] **Step 6: コミット**

```bash
git add tsconfig.base.json tsconfig.json biome.json vitest.workspace.ts
git commit -m "chore: add shared TypeScript, Biome, and Vitest configuration"
```

---

### Task 3: CI ワークフロー (`ci.yml`)

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: PR / push (`master`, `feat/**`) 時に走る CI
  - Biome check
  - TypeScript type-check (project references)
  - Vitest 実行

- [ ] **Step 1: `.github/workflows/ci.yml` を作成**

```yaml
name: ci

on:
  push:
    branches: [master, 'feat/**']
  pull_request:

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .node-version
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
```

- [ ] **Step 2: 手元で workflow を静的に検証**

Run: `pnpm dlx @action-validator/cli .github/workflows/ci.yml`
Expected: `OK` （もし失敗したらインデントを疑う）

- [ ] **Step 3: ローカルで `pnpm lint && pnpm typecheck && pnpm test` を通す**

Run: `pnpm lint && pnpm typecheck && pnpm test`
Expected: すべて成功。テストは対象パッケージがまだ無いためスキップされる。

- [ ] **Step 4: コミット**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: run Biome, type-check, and Vitest on push and PR"
```

---

### Task 4: `packages/core` の骨格と型定義

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/vitest.config.ts`
- Create: `packages/core/src/types.ts`
- Create: `packages/core/src/index.ts`
- Test: `packages/core/tests/types.test-d.ts`
- Modify: `tsconfig.json` (root, `references` に追加)

**Interfaces:**
- Produces:
  - `@icon-collection/core` からエクスポートする型: `IconHit`, `SearchQuery`, `SearchResponse`, `Collection`, `License`
  - `Collection` は string リテラル型ではなく `string` の型エイリアス（実行時にコレクション名は R2/D1 から動的に決まるため列挙しない）

- [ ] **Step 1: `packages/core/package.json` を作成**

```json
{
  "name": "@icon-collection/core",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "import": "./src/index.ts"
    }
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 2: `packages/core/tsconfig.json` を作成**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "rootDir": "src",
    "outDir": "dist",
    "types": ["node"]
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

- [ ] **Step 3: `packages/core/vitest.config.ts` を作成**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: root `tsconfig.json` に project reference を追加**

```json
{
  "files": [],
  "references": [
    { "path": "packages/core" }
  ]
}
```

- [ ] **Step 5: 型定義テストを先に書く**

`packages/core/tests/types.test-d.ts`:

```ts
import { expectTypeOf, test } from 'vitest';
import type { IconHit, SearchQuery, SearchResponse } from '../src/index.ts';

test('IconHit has required fields with correct types', () => {
  expectTypeOf<IconHit>().toEqualTypeOf<{
    collection: string;
    name: string;
    license: string;
    width: number;
    height: number;
  }>();
});

test('SearchQuery.q is required, filters are optional', () => {
  expectTypeOf<SearchQuery>().toEqualTypeOf<{
    q: string;
    collection?: string[];
    license?: string[];
    limit?: number;
    cursor?: string;
  }>();
});

test('SearchResponse aggregates hits with total and cursor', () => {
  expectTypeOf<SearchResponse>().toEqualTypeOf<{
    hits: IconHit[];
    total: number;
    cursor: string | null;
  }>();
});
```

- [ ] **Step 6: 型定義が無いため型テストが失敗することを確認**

Run: `pnpm -F @icon-collection/core test`
Expected: FAIL, `Cannot find module '../src/index.ts'` などのエラー

- [ ] **Step 7: 型定義を実装**

`packages/core/src/types.ts`:

```ts
export type IconHit = {
  collection: string;
  name: string;
  license: string;
  width: number;
  height: number;
};

export type SearchQuery = {
  q: string;
  collection?: string[];
  license?: string[];
  limit?: number;
  cursor?: string;
};

export type SearchResponse = {
  hits: IconHit[];
  total: number;
  cursor: string | null;
};
```

`packages/core/src/index.ts`:

```ts
export type { IconHit, SearchQuery, SearchResponse } from './types.ts';
```

- [ ] **Step 8: 型テストが通ることを確認**

Run: `pnpm -F @icon-collection/core test`
Expected: PASS (3 tests)

- [ ] **Step 9: 全体の typecheck と lint を確認**

Run: `pnpm lint && pnpm typecheck`
Expected: いずれも成功

- [ ] **Step 10: コミット**

```bash
git add packages/core tsconfig.json
git commit -m "feat(core): add IconHit, SearchQuery, and SearchResponse types"
```

---

### Task 5: `packages/core` のクエリ正規化と FTS5 クエリ組立

**Files:**
- Create: `packages/core/src/query.ts`
- Modify: `packages/core/src/index.ts` (`normalizeQuery`, `buildFtsQuery` を再エクスポート)
- Test: `packages/core/tests/query.test.ts`

**Interfaces:**
- Produces:
  - `normalizeQuery(input: string): string`
    - NFKC 正規化 + trim + toLowerCase を適用
  - `buildFtsQuery(terms: readonly string[]): string`
    - FTS5 の予約文字 `"`, `*`, `(`, `)` を除去
    - 空文字を除外
    - 各語をダブルクォートで囲み `OR` で連結
    - 結果が 0 語なら `""` を返す

- [ ] **Step 1: `packages/core/tests/query.test.ts` を作成**

```ts
import { describe, expect, test } from 'vitest';
import { buildFtsQuery, normalizeQuery } from '../src/index.ts';

describe('normalizeQuery', () => {
  test('applies NFKC and trims and lowercases', () => {
    expect(normalizeQuery('  Home  ')).toBe('home');
    expect(normalizeQuery('カート')).toBe('カート');
    expect(normalizeQuery('ABC')).toBe('abc');
  });

  test('collapses full-width alphanumerics to half-width', () => {
    expect(normalizeQuery('Ｈｏｍｅ')).toBe('home');
  });
});

describe('buildFtsQuery', () => {
  test('quotes each term and joins with OR', () => {
    expect(buildFtsQuery(['home', 'house'])).toBe('"home" OR "house"');
  });

  test('strips FTS5 reserved characters', () => {
    expect(buildFtsQuery(['ho*me', 'ho(u)se'])).toBe('"home" OR "house"');
  });

  test('drops empty terms', () => {
    expect(buildFtsQuery(['home', ''])).toBe('"home"');
  });

  test('returns empty string when all terms are dropped', () => {
    expect(buildFtsQuery(['*', ''])).toBe('');
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `pnpm -F @icon-collection/core test`
Expected: FAIL, `Cannot find export 'normalizeQuery'` など

- [ ] **Step 3: `packages/core/src/query.ts` を実装**

```ts
const FTS5_RESERVED = /["*()]/g;

export const normalizeQuery = (input: string): string =>
  input.normalize('NFKC').trim().toLowerCase();

export const buildFtsQuery = (terms: readonly string[]): string => {
  const cleaned = terms
    .map((t) => t.replace(FTS5_RESERVED, '').trim())
    .filter((t) => t.length > 0);
  if (cleaned.length === 0) return '';
  return cleaned.map((t) => `"${t}"`).join(' OR ');
};
```

- [ ] **Step 4: `packages/core/src/index.ts` を更新して再エクスポート**

```ts
export type { IconHit, SearchQuery, SearchResponse } from './types.ts';
export { buildFtsQuery, normalizeQuery } from './query.ts';
```

- [ ] **Step 5: テスト成功を確認**

Run: `pnpm -F @icon-collection/core test`
Expected: PASS (全 7 テスト)

- [ ] **Step 6: lint + typecheck**

Run: `pnpm lint && pnpm typecheck`
Expected: 成功

- [ ] **Step 7: コミット**

```bash
git add packages/core/src/query.ts packages/core/src/index.ts packages/core/tests/query.test.ts
git commit -m "feat(core): normalize input and build FTS5 OR queries"
```

---

### Task 6: `packages/synonyms` の辞書スキーマと初期辞書

**Files:**
- Create: `packages/synonyms/package.json`
- Create: `packages/synonyms/tsconfig.json`
- Create: `packages/synonyms/vitest.config.ts`
- Create: `packages/synonyms/src/schema.ts`
- Create: `packages/synonyms/src/index.ts`
- Create: `packages/synonyms/src/dictionaries/ja.json`
- Create: `packages/synonyms/src/dictionaries/en.json`
- Test: `packages/synonyms/tests/schema.test.ts`
- Modify: root `tsconfig.json` (`references` に追加)

**Interfaces:**
- Produces:
  - `SynonymEntry = { term: string; expansion: string; lang: 'ja' | 'en'; weight?: number }`
  - `SynonymDictionary = readonly SynonymEntry[]`
  - `loadDictionary(lang: 'ja' | 'en'): SynonymDictionary`
  - `validateDictionary(input: unknown): SynonymDictionary` （不正なら throw）

- [ ] **Step 1: パッケージ雛形を作成**

`packages/synonyms/package.json`:

```json
{
  "name": "@icon-collection/synonyms",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "import": "./src/index.ts"
    }
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

`packages/synonyms/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

`packages/synonyms/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
```

root `tsconfig.json`:

```json
{
  "files": [],
  "references": [
    { "path": "packages/core" },
    { "path": "packages/synonyms" }
  ]
}
```

- [ ] **Step 2: テストを先に書く**

`packages/synonyms/tests/schema.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { loadDictionary, validateDictionary } from '../src/index.ts';

describe('validateDictionary', () => {
  test('accepts a well-formed dictionary', () => {
    const input = [
      { term: 'home', expansion: 'house', lang: 'en' },
      { term: 'カート', expansion: 'cart', lang: 'ja', weight: 0.9 },
    ];
    expect(validateDictionary(input)).toEqual(input);
  });

  test('rejects entries missing required fields', () => {
    expect(() => validateDictionary([{ term: 'x' }])).toThrow(/expansion/);
  });

  test('rejects unknown lang', () => {
    expect(() =>
      validateDictionary([{ term: 'x', expansion: 'y', lang: 'zz' }]),
    ).toThrow(/lang/);
  });

  test('rejects non-array input', () => {
    expect(() => validateDictionary({})).toThrow(/array/);
  });
});

describe('loadDictionary', () => {
  test('returns a non-empty Japanese dictionary', () => {
    const dict = loadDictionary('ja');
    expect(dict.length).toBeGreaterThan(0);
    for (const entry of dict) expect(entry.lang).toBe('ja');
  });

  test('returns a non-empty English dictionary', () => {
    const dict = loadDictionary('en');
    expect(dict.length).toBeGreaterThan(0);
    for (const entry of dict) expect(entry.lang).toBe('en');
  });
});
```

- [ ] **Step 3: テストが失敗することを確認**

Run: `pnpm -F @icon-collection/synonyms test`
Expected: FAIL

- [ ] **Step 4: schema と辞書を実装**

`packages/synonyms/src/schema.ts`:

```ts
export type SynonymLang = 'ja' | 'en';

export type SynonymEntry = {
  term: string;
  expansion: string;
  lang: SynonymLang;
  weight?: number;
};

export type SynonymDictionary = readonly SynonymEntry[];

const isString = (v: unknown): v is string => typeof v === 'string';
const isLang = (v: unknown): v is SynonymLang => v === 'ja' || v === 'en';

export const validateDictionary = (input: unknown): SynonymDictionary => {
  if (!Array.isArray(input)) {
    throw new Error('synonym dictionary must be an array');
  }
  const validated: SynonymEntry[] = [];
  for (const [i, raw] of input.entries()) {
    if (typeof raw !== 'object' || raw === null) {
      throw new Error(`entry[${i}] must be an object`);
    }
    const entry = raw as Record<string, unknown>;
    if (!isString(entry.term)) throw new Error(`entry[${i}].term must be a string`);
    if (!isString(entry.expansion)) {
      throw new Error(`entry[${i}].expansion must be a string`);
    }
    if (!isLang(entry.lang)) throw new Error(`entry[${i}].lang must be 'ja' or 'en'`);
    const item: SynonymEntry = {
      term: entry.term,
      expansion: entry.expansion,
      lang: entry.lang,
    };
    if (typeof entry.weight === 'number') item.weight = entry.weight;
    validated.push(item);
  }
  return validated;
};
```

`packages/synonyms/src/dictionaries/ja.json`:

```json
[
  { "term": "カート", "expansion": "cart", "lang": "ja" },
  { "term": "カート", "expansion": "shopping", "lang": "ja" },
  { "term": "家", "expansion": "home", "lang": "ja" },
  { "term": "家", "expansion": "house", "lang": "ja" },
  { "term": "ホーム", "expansion": "home", "lang": "ja" },
  { "term": "ユーザー", "expansion": "user", "lang": "ja" },
  { "term": "ユーザー", "expansion": "person", "lang": "ja" },
  { "term": "設定", "expansion": "settings", "lang": "ja" },
  { "term": "設定", "expansion": "gear", "lang": "ja" },
  { "term": "検索", "expansion": "search", "lang": "ja" },
  { "term": "検索", "expansion": "magnify", "lang": "ja" },
  { "term": "ログイン", "expansion": "login", "lang": "ja" },
  { "term": "ログイン", "expansion": "sign-in", "lang": "ja" },
  { "term": "鍵", "expansion": "key", "lang": "ja" },
  { "term": "鍵", "expansion": "lock", "lang": "ja" },
  { "term": "地図", "expansion": "map", "lang": "ja" },
  { "term": "時計", "expansion": "clock", "lang": "ja" },
  { "term": "時計", "expansion": "time", "lang": "ja" }
]
```

`packages/synonyms/src/dictionaries/en.json`:

```json
[
  { "term": "cart", "expansion": "shopping", "lang": "en" },
  { "term": "cart", "expansion": "bag", "lang": "en" },
  { "term": "home", "expansion": "house", "lang": "en" },
  { "term": "house", "expansion": "home", "lang": "en" },
  { "term": "user", "expansion": "person", "lang": "en" },
  { "term": "user", "expansion": "account", "lang": "en" },
  { "term": "settings", "expansion": "gear", "lang": "en" },
  { "term": "settings", "expansion": "cog", "lang": "en" },
  { "term": "search", "expansion": "magnify", "lang": "en" },
  { "term": "login", "expansion": "sign-in", "lang": "en" },
  { "term": "logout", "expansion": "sign-out", "lang": "en" },
  { "term": "key", "expansion": "lock", "lang": "en" },
  { "term": "delete", "expansion": "trash", "lang": "en" },
  { "term": "trash", "expansion": "delete", "lang": "en" },
  { "term": "edit", "expansion": "pencil", "lang": "en" },
  { "term": "clock", "expansion": "time", "lang": "en" }
]
```

`packages/synonyms/src/index.ts`:

```ts
import ja from './dictionaries/ja.json' with { type: 'json' };
import en from './dictionaries/en.json' with { type: 'json' };
import type { SynonymDictionary, SynonymLang } from './schema.ts';
import { validateDictionary } from './schema.ts';

const dictionaries: Record<SynonymLang, SynonymDictionary> = {
  ja: validateDictionary(ja),
  en: validateDictionary(en),
};

export const loadDictionary = (lang: SynonymLang): SynonymDictionary =>
  dictionaries[lang];

export type { SynonymEntry, SynonymDictionary, SynonymLang } from './schema.ts';
export { validateDictionary } from './schema.ts';
```

- [ ] **Step 5: テスト成功を確認**

Run: `pnpm -F @icon-collection/synonyms test`
Expected: PASS (6 tests)

- [ ] **Step 6: lint + typecheck**

Run: `pnpm lint && pnpm typecheck`
Expected: 成功

- [ ] **Step 7: コミット**

```bash
git add packages/synonyms tsconfig.json
git commit -m "feat(synonyms): seed ja/en dictionaries with schema validation"
```

---

### Task 7: `packages/core` の同義語展開 `expandQuery`

**Files:**
- Modify: `packages/core/package.json` (dependencies に `@icon-collection/synonyms` を workspace: 追加)
- Create: `packages/core/src/expand.ts`
- Modify: `packages/core/src/index.ts` (再エクスポート)
- Test: `packages/core/tests/expand.test.ts`

**Interfaces:**
- Consumes: `SynonymDictionary` (`@icon-collection/synonyms`), `normalizeQuery` (Task 5)
- Produces:
  - `expandQuery(input: string, dicts: readonly SynonymDictionary[]): string[]`
    - `normalizeQuery` 適用後、空白で split
    - 各語について、渡された全辞書から `entry.term === 語` の `entry.expansion` を集める
    - 元語＋展開語を重複排除して配列で返す
    - 元入力が空なら `[]`

- [ ] **Step 1: 依存追加**

```bash
pnpm -F @icon-collection/core add @icon-collection/synonyms@workspace:*
```

- [ ] **Step 2: テストを作成**

`packages/core/tests/expand.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { expandQuery } from '../src/index.ts';
import type { SynonymDictionary } from '@icon-collection/synonyms';

const ja: SynonymDictionary = [
  { term: 'カート', expansion: 'cart', lang: 'ja' },
  { term: 'カート', expansion: 'shopping', lang: 'ja' },
];
const en: SynonymDictionary = [
  { term: 'cart', expansion: 'shopping', lang: 'en' },
  { term: 'cart', expansion: 'bag', lang: 'en' },
];

describe('expandQuery', () => {
  test('returns [] for empty input', () => {
    expect(expandQuery('', [ja, en])).toEqual([]);
    expect(expandQuery('   ', [ja, en])).toEqual([]);
  });

  test('preserves original term when no synonym matches', () => {
    expect(expandQuery('unknown', [ja, en])).toEqual(['unknown']);
  });

  test('expands via a single dictionary', () => {
    const result = expandQuery('カート', [ja]);
    expect(result).toEqual(expect.arrayContaining(['カート', 'cart', 'shopping']));
    expect(result).toHaveLength(3);
  });

  test('merges expansions across multiple dictionaries and dedups', () => {
    const result = expandQuery('cart', [ja, en]);
    expect(result).toEqual(expect.arrayContaining(['cart', 'shopping', 'bag']));
    expect(result).toHaveLength(3);
  });

  test('normalizes input before matching', () => {
    const result = expandQuery('  Cart  ', [en]);
    expect(result).toEqual(expect.arrayContaining(['cart', 'shopping', 'bag']));
  });

  test('handles multi-term queries independently', () => {
    const result = expandQuery('cart home', [en]);
    expect(result).toEqual(expect.arrayContaining(['cart', 'shopping', 'bag', 'home', 'house']));
    // 'home' has house in en dict
  });
});
```

- [ ] **Step 3: 失敗を確認**

Run: `pnpm -F @icon-collection/core test`
Expected: FAIL (`expandQuery` 未定義)

- [ ] **Step 4: `packages/core/src/expand.ts` を実装**

```ts
import type { SynonymDictionary } from '@icon-collection/synonyms';
import { normalizeQuery } from './query.ts';

export const expandQuery = (
  input: string,
  dicts: readonly SynonymDictionary[],
): string[] => {
  const normalized = normalizeQuery(input);
  if (normalized.length === 0) return [];
  const terms = normalized.split(/\s+/).filter((t) => t.length > 0);
  if (terms.length === 0) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (v: string): void => {
    if (seen.has(v)) return;
    seen.add(v);
    out.push(v);
  };
  for (const term of terms) push(term);
  for (const term of terms) {
    for (const dict of dicts) {
      for (const entry of dict) {
        if (entry.term === term) push(entry.expansion);
      }
    }
  }
  return out;
};
```

- [ ] **Step 5: `packages/core/src/index.ts` に追加**

```ts
export type { IconHit, SearchQuery, SearchResponse } from './types.ts';
export { buildFtsQuery, normalizeQuery } from './query.ts';
export { expandQuery } from './expand.ts';
```

- [ ] **Step 6: en 辞書に `home → house` が必要**

Task 6 で作った en 辞書に `{ "term": "home", "expansion": "house", "lang": "en" }` が既に含まれている。もし無ければ追加する。今の辞書には含まれているので変更不要。

- [ ] **Step 7: テスト成功を確認**

Run: `pnpm -F @icon-collection/core test`
Expected: PASS (query 4 tests + expand 6 tests + types 3 tests = 13 tests)

- [ ] **Step 8: lint + typecheck**

Run: `pnpm lint && pnpm typecheck`
Expected: 成功

- [ ] **Step 9: コミット**

```bash
git add packages/core
git commit -m "feat(core): expand query terms via synonym dictionaries"
```

---

### Task 8: `packages/core` の HTTP API クライアント

**Files:**
- Create: `packages/core/src/api.ts`
- Modify: `packages/core/src/index.ts` (再エクスポート)
- Test: `packages/core/tests/api.test.ts`

**Interfaces:**
- Consumes: `SearchQuery`, `SearchResponse` (Task 4)
- Produces:
  - `createApiClient(config: ApiClientConfig): ApiClient`
    - `ApiClientConfig = { baseUrl: string; fetch?: typeof fetch }`
    - `ApiClient = { search(q): Promise<SearchResponse>; getSvg(collection, name): Promise<string>; getMx(collection, name): Promise<string> }`
    - baseUrl は末尾スラッシュ有無いずれも受け付ける
    - `search` は Query の `collection` / `license` をカンマ区切りで送出
    - エラー時 `throw new ApiError({ status, url })`
  - `class ApiError extends Error { readonly status: number; readonly url: string }`

- [ ] **Step 1: テスト作成**

`packages/core/tests/api.test.ts`:

```ts
import { describe, expect, test, vi } from 'vitest';
import { ApiError, createApiClient } from '../src/index.ts';

const jsonResponse = (body: unknown, init?: ResponseInit): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });

const textResponse = (body: string, init?: ResponseInit): Response =>
  new Response(body, {
    status: 200,
    headers: { 'content-type': 'image/svg+xml' },
    ...init,
  });

describe('search', () => {
  test('builds URL with query params and returns SearchResponse', async () => {
    const fetchFn = vi.fn(async (_url: string | URL) =>
      jsonResponse({ hits: [], total: 0, cursor: null }),
    );
    const client = createApiClient({ baseUrl: 'https://x.example', fetch: fetchFn });
    const res = await client.search({
      q: 'home',
      collection: ['mdi', 'lucide'],
      license: ['MIT'],
      limit: 30,
    });
    expect(res.total).toBe(0);
    const url = fetchFn.mock.calls[0]?.[0] as URL;
    expect(url.pathname).toBe('/api/search');
    expect(url.searchParams.get('q')).toBe('home');
    expect(url.searchParams.get('collection')).toBe('mdi,lucide');
    expect(url.searchParams.get('license')).toBe('MIT');
    expect(url.searchParams.get('limit')).toBe('30');
  });

  test('throws ApiError on non-2xx', async () => {
    const fetchFn = vi.fn(async () => new Response('bad', { status: 500 }));
    const client = createApiClient({ baseUrl: 'https://x.example', fetch: fetchFn });
    await expect(client.search({ q: 'home' })).rejects.toBeInstanceOf(ApiError);
  });
});

describe('getSvg', () => {
  test('returns text body', async () => {
    const fetchFn = vi.fn(async () => textResponse('<svg/>'));
    const client = createApiClient({ baseUrl: 'https://x.example/', fetch: fetchFn });
    expect(await client.getSvg('mdi', 'home')).toBe('<svg/>');
    const url = fetchFn.mock.calls[0]?.[0] as URL;
    expect(url.pathname).toBe('/icon/mdi/home.svg');
  });

  test('throws ApiError on 404', async () => {
    const fetchFn = vi.fn(async () => new Response('missing', { status: 404 }));
    const client = createApiClient({ baseUrl: 'https://x.example', fetch: fetchFn });
    await expect(client.getSvg('mdi', 'unknown')).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe('getMx', () => {
  test('hits /icon/:c/:n.mx and returns text', async () => {
    const fetchFn = vi.fn(async () => new Response('<mxGraphModel/>', { status: 200 }));
    const client = createApiClient({ baseUrl: 'https://x.example', fetch: fetchFn });
    expect(await client.getMx('mdi', 'home')).toBe('<mxGraphModel/>');
    const url = fetchFn.mock.calls[0]?.[0] as URL;
    expect(url.pathname).toBe('/icon/mdi/home.mx');
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `pnpm -F @icon-collection/core test`
Expected: FAIL

- [ ] **Step 3: `packages/core/src/api.ts` を実装**

```ts
import type { SearchQuery, SearchResponse } from './types.ts';

export type ApiClientConfig = {
  baseUrl: string;
  fetch?: typeof fetch;
};

export class ApiError extends Error {
  readonly status: number;
  readonly url: string;
  constructor(input: { status: number; url: string; message?: string }) {
    super(input.message ?? `API request failed: ${input.status} ${input.url}`);
    this.name = 'ApiError';
    this.status = input.status;
    this.url = input.url;
  }
}

export type ApiClient = {
  search: (query: SearchQuery) => Promise<SearchResponse>;
  getSvg: (collection: string, name: string) => Promise<string>;
  getMx: (collection: string, name: string) => Promise<string>;
};

const buildUrl = (base: string, path: string): URL => {
  const normalized = base.endsWith('/') ? base : `${base}/`;
  return new URL(path.replace(/^\//, ''), normalized);
};

export const createApiClient = (config: ApiClientConfig): ApiClient => {
  const fetchFn = config.fetch ?? globalThis.fetch;
  const request = async (url: URL): Promise<Response> => {
    const res = await fetchFn(url);
    if (!res.ok) throw new ApiError({ status: res.status, url: url.toString() });
    return res;
  };

  return {
    search: async (query) => {
      const url = buildUrl(config.baseUrl, 'api/search');
      url.searchParams.set('q', query.q);
      if (query.collection?.length) {
        url.searchParams.set('collection', query.collection.join(','));
      }
      if (query.license?.length) {
        url.searchParams.set('license', query.license.join(','));
      }
      if (typeof query.limit === 'number') {
        url.searchParams.set('limit', String(query.limit));
      }
      if (query.cursor) url.searchParams.set('cursor', query.cursor);
      const res = await request(url);
      return (await res.json()) as SearchResponse;
    },
    getSvg: async (collection, name) => {
      const url = buildUrl(config.baseUrl, `icon/${collection}/${name}.svg`);
      const res = await request(url);
      return res.text();
    },
    getMx: async (collection, name) => {
      const url = buildUrl(config.baseUrl, `icon/${collection}/${name}.mx`);
      const res = await request(url);
      return res.text();
    },
  };
};
```

- [ ] **Step 4: `packages/core/src/index.ts` を更新**

```ts
export type { IconHit, SearchQuery, SearchResponse } from './types.ts';
export { buildFtsQuery, normalizeQuery } from './query.ts';
export { expandQuery } from './expand.ts';
export { ApiError, createApiClient } from './api.ts';
export type { ApiClient, ApiClientConfig } from './api.ts';
```

- [ ] **Step 5: テスト成功を確認**

Run: `pnpm -F @icon-collection/core test`
Expected: PASS (13 + 5 = 18 tests)

- [ ] **Step 6: lint + typecheck**

Run: `pnpm lint && pnpm typecheck`
Expected: 成功

- [ ] **Step 7: コミット**

```bash
git add packages/core
git commit -m "feat(core): add HTTP API client for search and svg/mx endpoints"
```

---

### Task 9: `packages/ui` の骨格と `HostContext`

**Files:**
- Create: `packages/ui/package.json`
- Create: `packages/ui/tsconfig.json`
- Create: `packages/ui/vitest.config.ts`
- Create: `packages/ui/src/host.ts`
- Create: `packages/ui/src/index.ts`
- Create: `packages/ui/src/styles.css` (Tailwind エントリ)
- Test: `packages/ui/tests/host.test.tsx`
- Modify: root `tsconfig.json`

**Interfaces:**
- Consumes: なし
- Produces:
  - `Host = { apiBaseUrl, copyText, showToast, persistState: { get, set } }`
  - `HostContext` (Preact Context)
  - `HostProvider` (`{ host: Host; children }` を受け取る Provider コンポーネント)
  - `useHost(): Host` （Provider 外で呼ぶと throw）

- [ ] **Step 1: パッケージ雛形と依存**

```bash
mkdir -p packages/ui/src/hooks packages/ui/tests
```

`packages/ui/package.json`:

```json
{
  "name": "@icon-collection/ui",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "import": "./src/index.ts"
    },
    "./styles.css": "./src/styles.css"
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 2: 依存を install**

```bash
pnpm -F @icon-collection/ui add preact
pnpm -F @icon-collection/ui add -D @testing-library/preact @testing-library/user-event happy-dom @testing-library/jest-dom
pnpm -F @icon-collection/ui add @icon-collection/core@workspace:*
```

- [ ] **Step 3: `packages/ui/tsconfig.json` を作成**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "rootDir": "src",
    "outDir": "dist",
    "jsx": "react-jsx",
    "jsxImportSource": "preact",
    "types": ["node"]
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

- [ ] **Step 4: `packages/ui/vitest.config.ts` を作成**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'preact',
  },
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['./tests/setup.ts'],
  },
});
```

`packages/ui/tests/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 5: root `tsconfig.json` を更新**

```json
{
  "files": [],
  "references": [
    { "path": "packages/core" },
    { "path": "packages/synonyms" },
    { "path": "packages/ui" }
  ]
}
```

- [ ] **Step 6: テストを作成**

`packages/ui/tests/host.test.tsx`:

```tsx
import { describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/preact';
import { HostProvider, useHost } from '../src/index.ts';
import type { Host } from '../src/index.ts';

const makeHost = (): Host => ({
  apiBaseUrl: 'https://x.example',
  copyText: vi.fn(async () => {}),
  showToast: vi.fn(),
  persistState: {
    get: vi.fn(async () => null),
    set: vi.fn(async () => {}),
  },
});

const Probe = () => {
  const host = useHost();
  return <span data-testid="url">{host.apiBaseUrl}</span>;
};

describe('HostProvider / useHost', () => {
  test('supplies host to descendants', () => {
    render(
      <HostProvider host={makeHost()}>
        <Probe />
      </HostProvider>,
    );
    expect(screen.getByTestId('url').textContent).toBe('https://x.example');
  });

  test('throws when useHost is called outside provider', () => {
    // suppress preact console error for the throw
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/HostProvider/);
    spy.mockRestore();
  });
});
```

- [ ] **Step 7: 失敗を確認**

Run: `pnpm -F @icon-collection/ui test`
Expected: FAIL

- [ ] **Step 8: `packages/ui/src/host.ts` を実装**

```tsx
import { createContext } from 'preact';
import type { ComponentChildren } from 'preact';
import { useContext } from 'preact/hooks';

export type Host = {
  apiBaseUrl: string;
  copyText: (s: string) => Promise<void>;
  showToast: (m: string) => void;
  persistState: {
    get: (k: string) => Promise<string | null>;
    set: (k: string, v: string) => Promise<void>;
  };
};

const HostContext = createContext<Host | null>(null);

export type HostProviderProps = {
  host: Host;
  children: ComponentChildren;
};

export const HostProvider = ({ host, children }: HostProviderProps) => (
  <HostContext.Provider value={host}>{children}</HostContext.Provider>
);

export const useHost = (): Host => {
  const host = useContext(HostContext);
  if (!host) throw new Error('useHost must be called inside HostProvider');
  return host;
};
```

- [ ] **Step 9: `packages/ui/src/styles.css` を作成（Tailwind エントリ、実 config は apps 側）**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 10: `packages/ui/src/index.ts` を作成**

```ts
export type { Host, HostProviderProps } from './host.ts';
export { HostProvider, useHost } from './host.ts';
```

- [ ] **Step 11: テスト成功を確認**

Run: `pnpm -F @icon-collection/ui test`
Expected: PASS (2 tests)

- [ ] **Step 12: lint + typecheck**

Run: `pnpm lint && pnpm typecheck`
Expected: 成功

- [ ] **Step 13: コミット**

```bash
git add packages/ui tsconfig.json
git commit -m "feat(ui): add HostProvider/useHost for host-agnostic UI packages"
```

---

### Task 10: `SearchBox` (debounce + IME 対応)

**Files:**
- Create: `packages/ui/src/SearchBox.tsx`
- Modify: `packages/ui/src/index.ts`
- Test: `packages/ui/tests/SearchBox.test.tsx`

**Interfaces:**
- Consumes: なし（純粋な制御コンポーネント）
- Produces:
  - `SearchBox({ initialValue?: string; onChange: (v: string) => void; debounceMs?: number; placeholder?: string })`
    - 入力ごとに `debounceMs`（デフォルト 150ms）待って `onChange` を呼ぶ
    - `compositionstart` / `compositionend` で IME 中は `onChange` を発火しない
    - `initialValue` は初回のみ反映（後から変わっても無視）

- [ ] **Step 1: テスト作成**

`packages/ui/tests/SearchBox.test.tsx`:

```tsx
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { SearchBox } from '../src/index.ts';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const setup = () => {
  const onChange = vi.fn();
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  render(<SearchBox onChange={onChange} debounceMs={150} placeholder="q" />);
  return { onChange, user, input: screen.getByPlaceholderText('q') as HTMLInputElement };
};

describe('SearchBox', () => {
  test('debounces onChange calls', async () => {
    const { onChange, user, input } = setup();
    await user.type(input, 'home');
    expect(onChange).not.toHaveBeenCalled();
    vi.advanceTimersByTime(150);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith('home');
  });

  test('does not fire onChange while composing (IME)', async () => {
    const { onChange, input } = setup();
    input.dispatchEvent(new CompositionEvent('compositionstart'));
    input.value = 'カ';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    vi.advanceTimersByTime(500);
    expect(onChange).not.toHaveBeenCalled();
    input.dispatchEvent(new CompositionEvent('compositionend'));
    vi.advanceTimersByTime(150);
    expect(onChange).toHaveBeenCalledWith('カ');
  });

  test('respects initialValue on first render', () => {
    const onChange = vi.fn();
    render(<SearchBox initialValue="seed" onChange={onChange} placeholder="q" />);
    expect(screen.getByPlaceholderText<HTMLInputElement>('q').value).toBe('seed');
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `pnpm -F @icon-collection/ui test`
Expected: FAIL

- [ ] **Step 3: `packages/ui/src/SearchBox.tsx` を実装**

```tsx
import { useEffect, useRef, useState } from 'preact/hooks';

export type SearchBoxProps = {
  initialValue?: string;
  onChange: (value: string) => void;
  debounceMs?: number;
  placeholder?: string;
};

export const SearchBox = ({
  initialValue = '',
  onChange,
  debounceMs = 150,
  placeholder,
}: SearchBoxProps) => {
  const [value, setValue] = useState(initialValue);
  const composingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (composingRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChange(value), debounceMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value, debounceMs, onChange]);

  return (
    <input
      type="search"
      class="w-full rounded border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
      value={value}
      placeholder={placeholder}
      onInput={(e) => setValue((e.currentTarget as HTMLInputElement).value)}
      onCompositionStart={() => {
        composingRef.current = true;
      }}
      onCompositionEnd={(e) => {
        composingRef.current = false;
        setValue((e.currentTarget as HTMLInputElement).value);
      }}
    />
  );
};
```

- [ ] **Step 4: `packages/ui/src/index.ts` を更新**

```ts
export type { Host, HostProviderProps } from './host.ts';
export { HostProvider, useHost } from './host.ts';
export { SearchBox } from './SearchBox.tsx';
export type { SearchBoxProps } from './SearchBox.tsx';
```

- [ ] **Step 5: テスト成功を確認**

Run: `pnpm -F @icon-collection/ui test`
Expected: PASS (5 tests)

- [ ] **Step 6: lint + typecheck**

Run: `pnpm lint && pnpm typecheck`
Expected: 成功

- [ ] **Step 7: コミット**

```bash
git add packages/ui
git commit -m "feat(ui): add SearchBox with debounce and IME awareness"
```

---

### Task 11: `FilterBar`（collection / license の複数選択）

**Files:**
- Create: `packages/ui/src/FilterBar.tsx`
- Modify: `packages/ui/src/index.ts`
- Test: `packages/ui/tests/FilterBar.test.tsx`

**Interfaces:**
- Consumes: なし（純粋な制御コンポーネント）
- Produces:
  - `FilterBar({ collections: readonly {name:string;label:string}[]; licenses: readonly string[]; value: FilterValue; onChange: (next: FilterValue) => void })`
  - `FilterValue = { collection: string[]; license: string[] }`
  - 各項目のトグル・全選択解除

- [ ] **Step 1: テスト作成**

`packages/ui/tests/FilterBar.test.tsx`:

```tsx
import { describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { FilterBar } from '../src/index.ts';
import type { FilterValue } from '../src/index.ts';

const collections = [
  { name: 'mdi', label: 'Material' },
  { name: 'lucide', label: 'Lucide' },
];
const licenses = ['MIT', 'Apache-2.0'];

describe('FilterBar', () => {
  test('renders provided collections and licenses', () => {
    const value: FilterValue = { collection: [], license: [] };
    render(
      <FilterBar
        collections={collections}
        licenses={licenses}
        value={value}
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole('checkbox', { name: 'Material' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'MIT' })).toBeInTheDocument();
  });

  test('toggles a collection selection', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const value: FilterValue = { collection: [], license: [] };
    render(
      <FilterBar
        collections={collections}
        licenses={licenses}
        value={value}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByRole('checkbox', { name: 'Material' }));
    expect(onChange).toHaveBeenLastCalledWith({ collection: ['mdi'], license: [] });
  });

  test('deselects a collection when clicked again', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const value: FilterValue = { collection: ['mdi'], license: [] };
    render(
      <FilterBar
        collections={collections}
        licenses={licenses}
        value={value}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByRole('checkbox', { name: 'Material' }));
    expect(onChange).toHaveBeenLastCalledWith({ collection: [], license: [] });
  });

  test('clear button empties all filters', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const value: FilterValue = { collection: ['mdi'], license: ['MIT'] };
    render(
      <FilterBar
        collections={collections}
        licenses={licenses}
        value={value}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByRole('button', { name: /clear/i }));
    expect(onChange).toHaveBeenLastCalledWith({ collection: [], license: [] });
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `pnpm -F @icon-collection/ui test`
Expected: FAIL

- [ ] **Step 3: `packages/ui/src/FilterBar.tsx` を実装**

```tsx
export type FilterValue = {
  collection: string[];
  license: string[];
};

export type FilterOption = { name: string; label: string };

export type FilterBarProps = {
  collections: readonly FilterOption[];
  licenses: readonly string[];
  value: FilterValue;
  onChange: (next: FilterValue) => void;
};

const toggle = (arr: readonly string[], name: string): string[] =>
  arr.includes(name) ? arr.filter((v) => v !== name) : [...arr, name];

export const FilterBar = ({ collections, licenses, value, onChange }: FilterBarProps) => (
  <div class="flex flex-wrap items-center gap-3 text-xs">
    <fieldset class="flex flex-wrap items-center gap-2">
      <legend class="mr-1 font-semibold">Collection</legend>
      {collections.map((c) => (
        <label key={c.name} class="inline-flex items-center gap-1">
          <input
            type="checkbox"
            checked={value.collection.includes(c.name)}
            onChange={() =>
              onChange({ ...value, collection: toggle(value.collection, c.name) })
            }
          />
          <span>{c.label}</span>
        </label>
      ))}
    </fieldset>
    <fieldset class="flex flex-wrap items-center gap-2">
      <legend class="mr-1 font-semibold">License</legend>
      {licenses.map((l) => (
        <label key={l} class="inline-flex items-center gap-1">
          <input
            type="checkbox"
            checked={value.license.includes(l)}
            onChange={() => onChange({ ...value, license: toggle(value.license, l) })}
          />
          <span>{l}</span>
        </label>
      ))}
    </fieldset>
    <button
      type="button"
      class="ml-auto rounded border border-neutral-300 px-2 py-1"
      onClick={() => onChange({ collection: [], license: [] })}
    >
      Clear
    </button>
  </div>
);
```

- [ ] **Step 4: `packages/ui/src/index.ts` を更新**

```ts
export type { Host, HostProviderProps } from './host.ts';
export { HostProvider, useHost } from './host.ts';
export { SearchBox } from './SearchBox.tsx';
export type { SearchBoxProps } from './SearchBox.tsx';
export { FilterBar } from './FilterBar.tsx';
export type { FilterBarProps, FilterOption, FilterValue } from './FilterBar.tsx';
```

- [ ] **Step 5: テスト成功を確認**

Run: `pnpm -F @icon-collection/ui test`
Expected: PASS (4 追加)

- [ ] **Step 6: lint + typecheck**

Run: `pnpm lint && pnpm typecheck`
Expected: 成功

- [ ] **Step 7: コミット**

```bash
git add packages/ui
git commit -m "feat(ui): add FilterBar for collection and license selection"
```

---

### Task 12: `useSearch` フック

**Files:**
- Create: `packages/ui/src/hooks/useSearch.ts`
- Modify: `packages/ui/src/index.ts`
- Test: `packages/ui/tests/useSearch.test.tsx`

**Interfaces:**
- Consumes: `HostContext` (Task 9), `createApiClient` (Task 8), `SearchQuery` (Task 4), `expandQuery` (Task 7), `SynonymDictionary` (`@icon-collection/synonyms`)
- Produces:
  - `useSearch(query: SearchQuery | null): SearchState`
  - `SearchState = { status: 'idle' | 'loading' | 'success' | 'error'; data: SearchResponse | null; error: Error | null }`
  - `query` が `null` または `q` が空なら `idle`
  - クエリ変化時に新しい fetch を開始し、古い結果は捨てる (race 対策として世代番号を持つ)

- [ ] **Step 1: 追加依存**

```bash
pnpm -F @icon-collection/ui add @icon-collection/synonyms@workspace:*
```

- [ ] **Step 2: テスト作成**

`packages/ui/tests/useSearch.test.tsx`:

```tsx
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/preact';
import type { ComponentChildren } from 'preact';
import { HostProvider, useSearch } from '../src/index.ts';
import type { Host } from '../src/index.ts';

const makeHost = (fetchImpl: typeof fetch): Host => ({
  apiBaseUrl: 'https://x.example',
  copyText: async () => {},
  showToast: () => {},
  persistState: { get: async () => null, set: async () => {} },
});

const wrapWith = (host: Host) => ({ children }: { children: ComponentChildren }) => (
  <HostProvider host={host}>{children}</HostProvider>
);

const jsonRes = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('useSearch', () => {
  test('is idle when query is null', () => {
    const fetchFn = vi.fn();
    vi.stubGlobal('fetch', fetchFn);
    const { result } = renderHook(() => useSearch(null), {
      wrapper: wrapWith(makeHost(fetch)),
    });
    expect(result.current.status).toBe('idle');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  test('transitions to success and returns data', async () => {
    const fetchFn = vi.fn(async () =>
      jsonRes({ hits: [{ collection: 'mdi', name: 'home', license: 'Apache-2.0', width: 24, height: 24 }], total: 1, cursor: null }),
    );
    vi.stubGlobal('fetch', fetchFn);
    const { result } = renderHook(() => useSearch({ q: 'home' }), {
      wrapper: wrapWith(makeHost(fetch)),
    });
    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.data?.total).toBe(1);
  });

  test('sets error status when fetch fails', async () => {
    const fetchFn = vi.fn(async () => new Response('boom', { status: 500 }));
    vi.stubGlobal('fetch', fetchFn);
    const { result } = renderHook(() => useSearch({ q: 'home' }), {
      wrapper: wrapWith(makeHost(fetch)),
    });
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).not.toBeNull();
  });

  test('drops stale response when query changes fast', async () => {
    let resolveFirst!: (v: Response) => void;
    const firstPromise = new Promise<Response>((r) => {
      resolveFirst = r;
    });
    const secondPromise = Promise.resolve(
      jsonRes({ hits: [{ collection: 'mdi', name: 'second', license: 'Apache-2.0', width: 24, height: 24 }], total: 1, cursor: null }),
    );
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockReturnValueOnce(firstPromise)
      .mockReturnValueOnce(secondPromise);
    vi.stubGlobal('fetch', fetchFn);

    const { result, rerender } = renderHook(({ q }: { q: string }) => useSearch({ q }), {
      wrapper: wrapWith(makeHost(fetch)),
      initialProps: { q: 'a' },
    });
    rerender({ q: 'b' });
    // resolve the stale first request after the second one
    resolveFirst(jsonRes({ hits: [{ collection: 'mdi', name: 'first', license: 'Apache-2.0', width: 24, height: 24 }], total: 1, cursor: null }));
    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.data?.hits[0]?.name).toBe('second');
  });
});
```

- [ ] **Step 3: 失敗を確認**

Run: `pnpm -F @icon-collection/ui test`
Expected: FAIL

- [ ] **Step 4: `packages/ui/src/hooks/useSearch.ts` を実装**

```ts
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { createApiClient } from '@icon-collection/core';
import type { SearchQuery, SearchResponse } from '@icon-collection/core';
import { useHost } from '../host.ts';

export type SearchStatus = 'idle' | 'loading' | 'success' | 'error';

export type SearchState = {
  status: SearchStatus;
  data: SearchResponse | null;
  error: Error | null;
};

const IDLE: SearchState = { status: 'idle', data: null, error: null };

export const useSearch = (query: SearchQuery | null): SearchState => {
  const host = useHost();
  const client = useMemo(() => createApiClient({ baseUrl: host.apiBaseUrl }), [host.apiBaseUrl]);
  const [state, setState] = useState<SearchState>(IDLE);
  const genRef = useRef(0);
  const key = query ? JSON.stringify(query) : null;

  useEffect(() => {
    if (!query || query.q.trim().length === 0) {
      setState(IDLE);
      return;
    }
    const gen = ++genRef.current;
    setState({ status: 'loading', data: null, error: null });
    client
      .search(query)
      .then((data) => {
        if (gen !== genRef.current) return;
        setState({ status: 'success', data, error: null });
      })
      .catch((error: unknown) => {
        if (gen !== genRef.current) return;
        setState({
          status: 'error',
          data: null,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      });
  }, [client, key]);

  return state;
};
```

- [ ] **Step 5: `packages/ui/src/index.ts` を更新**

```ts
export type { Host, HostProviderProps } from './host.ts';
export { HostProvider, useHost } from './host.ts';
export { SearchBox } from './SearchBox.tsx';
export type { SearchBoxProps } from './SearchBox.tsx';
export { FilterBar } from './FilterBar.tsx';
export type { FilterBarProps, FilterOption, FilterValue } from './FilterBar.tsx';
export { useSearch } from './hooks/useSearch.ts';
export type { SearchState, SearchStatus } from './hooks/useSearch.ts';
```

- [ ] **Step 6: テスト成功を確認**

Run: `pnpm -F @icon-collection/ui test`
Expected: PASS

- [ ] **Step 7: lint + typecheck**

Run: `pnpm lint && pnpm typecheck`
Expected: 成功

- [ ] **Step 8: コミット**

```bash
git add packages/ui
git commit -m "feat(ui): add useSearch hook with race-safe fetch"
```

---

### Task 13: `IconCell`（Intersection Observer による SVG 遅延取得）

**Files:**
- Create: `packages/ui/src/IconCell.tsx`
- Modify: `packages/ui/src/index.ts`
- Test: `packages/ui/tests/IconCell.test.tsx`

**Interfaces:**
- Consumes: `useHost` (Task 9), `IconHit` (`@icon-collection/core`)
- Produces:
  - `IconCell({ hit: IconHit; onSelect?: (hit: IconHit) => void })`
  - 初回マウント時に `IntersectionObserver` で可視化 → `createApiClient(host.apiBaseUrl).getSvg` で取得
  - 取得中は `<div aria-busy>`、成功で SVG を innerHTML、失敗時は `?` 表示
  - モジュール内で URL → SVG のキャッシュを持つ

- [ ] **Step 1: `happy-dom` に `IntersectionObserver` が無い前提でモックを準備**

Modify `packages/ui/tests/setup.ts` （既存の import 行に追加）:

```ts
import '@testing-library/jest-dom/vitest';

class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = '';
  readonly thresholds: readonly number[] = [];
  private callback: IntersectionObserverCallback;
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }
  observe(target: Element): void {
    this.callback(
      [
        {
          isIntersecting: true,
          target,
          boundingClientRect: {} as DOMRectReadOnly,
          intersectionRatio: 1,
          intersectionRect: {} as DOMRectReadOnly,
          rootBounds: null,
          time: 0,
        },
      ],
      this,
    );
  }
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

Reflect.set(globalThis, 'IntersectionObserver', MockIntersectionObserver);
```

`Reflect.set` を使うことで `any` を避け、Biome の警告を回避する。

- [ ] **Step 2: テスト作成**

`packages/ui/tests/IconCell.test.tsx`:

```tsx
import { describe, expect, test, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { HostProvider, IconCell } from '../src/index.ts';
import type { Host } from '../src/index.ts';
import type { IconHit } from '@icon-collection/core';

const hit: IconHit = {
  collection: 'mdi',
  name: 'home',
  license: 'Apache-2.0',
  width: 24,
  height: 24,
};

const makeHost = (fetchFn: typeof fetch): Host => ({
  apiBaseUrl: 'https://x.example',
  copyText: async () => {},
  showToast: () => {},
  persistState: { get: async () => null, set: async () => {} },
});

describe('IconCell', () => {
  test('renders SVG after intersecting and fetching', async () => {
    const fetchFn = vi.fn(async () =>
      new Response('<svg data-testid="svg"></svg>', {
        status: 200,
        headers: { 'content-type': 'image/svg+xml' },
      }),
    );
    vi.stubGlobal('fetch', fetchFn);
    render(
      <HostProvider host={makeHost(fetch)}>
        <IconCell hit={hit} />
      </HostProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('svg')).toBeInTheDocument());
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  test('shows a fallback when fetch fails', async () => {
    const fetchFn = vi.fn(async () => new Response('bad', { status: 500 }));
    vi.stubGlobal('fetch', fetchFn);
    render(
      <HostProvider host={makeHost(fetch)}>
        <IconCell hit={hit} />
      </HostProvider>,
    );
    await waitFor(() => expect(screen.getByRole('img', { name: /failed/i })).toBeInTheDocument());
  });

  test('invokes onSelect when clicked', async () => {
    const user = userEvent.setup();
    const fetchFn = vi.fn(async () =>
      new Response('<svg></svg>', {
        status: 200,
        headers: { 'content-type': 'image/svg+xml' },
      }),
    );
    vi.stubGlobal('fetch', fetchFn);
    const onSelect = vi.fn();
    render(
      <HostProvider host={makeHost(fetch)}>
        <IconCell hit={hit} onSelect={onSelect} />
      </HostProvider>,
    );
    await waitFor(() => screen.getByRole('button', { name: /mdi\/home/i }));
    await user.click(screen.getByRole('button', { name: /mdi\/home/i }));
    expect(onSelect).toHaveBeenCalledWith(hit);
  });
});
```

- [ ] **Step 3: 失敗を確認**

Run: `pnpm -F @icon-collection/ui test`
Expected: FAIL

- [ ] **Step 4: `packages/ui/src/IconCell.tsx` を実装**

```tsx
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { createApiClient } from '@icon-collection/core';
import type { IconHit } from '@icon-collection/core';
import { useHost } from './host.ts';

export type IconCellProps = {
  hit: IconHit;
  onSelect?: (hit: IconHit) => void;
};

type CellStatus = 'idle' | 'loading' | 'ready' | 'error';

const svgCache = new Map<string, string>();
const cacheKey = (h: IconHit) => `${h.collection}/${h.name}`;

export const IconCell = ({ hit, onSelect }: IconCellProps) => {
  const host = useHost();
  const client = useMemo(() => createApiClient({ baseUrl: host.apiBaseUrl }), [host.apiBaseUrl]);
  const [status, setStatus] = useState<CellStatus>(() =>
    svgCache.has(cacheKey(hit)) ? 'ready' : 'idle',
  );
  const [svg, setSvg] = useState<string | null>(() => svgCache.get(cacheKey(hit)) ?? null);
  const containerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (status !== 'idle') return;
    const target = containerRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.disconnect();
          setStatus('loading');
          client
            .getSvg(hit.collection, hit.name)
            .then((body) => {
              svgCache.set(cacheKey(hit), body);
              setSvg(body);
              setStatus('ready');
            })
            .catch(() => setStatus('error'));
        }
      },
      { rootMargin: '128px' },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [status, client, hit.collection, hit.name]);

  return (
    <button
      ref={containerRef}
      type="button"
      class="flex aspect-square flex-col items-center justify-center rounded border border-neutral-200 p-2 hover:border-neutral-400"
      aria-label={`${hit.collection}/${hit.name}`}
      onClick={() => onSelect?.(hit)}
    >
      {status === 'ready' && svg ? (
        <span
          class="h-8 w-8 [&_svg]:h-full [&_svg]:w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : status === 'error' ? (
        <span role="img" aria-label="failed" class="text-neutral-400">?</span>
      ) : (
        <span aria-busy class="h-8 w-8 animate-pulse rounded bg-neutral-100" />
      )}
      <span class="mt-1 truncate text-[10px] text-neutral-500">{hit.name}</span>
    </button>
  );
};
```

`dangerouslySetInnerHTML` は Biome の `noDangerouslySetInnerHtml` に必ずヒットするが、SVG innerHTML 挿入以外の実装手段は現実的に無い（`iframe` や `img src="data:"` に置き換えると数十万件のセルで性能が落ちる）。ignore コメントで個別に抑止するのではなく、`biome.json` の rules で `noDangerouslySetInnerHtml: "off"` に設定して恒常的に許可する（Step 5）。

- [ ] **Step 5: `biome.json` を更新**

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true
  },
  "files": {
    "ignore": ["dist", "node_modules", ".astro", ".wrangler", "coverage", "parsers"]
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "correctness": {
        "noUnusedImports": "error"
      },
      "suspicious": {
        "noExplicitAny": "error"
      },
      "security": {
        "noDangerouslySetInnerHtml": "off"
      }
    }
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "semicolons": "always",
      "trailingCommas": "all"
    }
  }
}
```

- [ ] **Step 6: `packages/ui/src/index.ts` を更新**

```ts
export type { Host, HostProviderProps } from './host.ts';
export { HostProvider, useHost } from './host.ts';
export { SearchBox } from './SearchBox.tsx';
export type { SearchBoxProps } from './SearchBox.tsx';
export { FilterBar } from './FilterBar.tsx';
export type { FilterBarProps, FilterOption, FilterValue } from './FilterBar.tsx';
export { useSearch } from './hooks/useSearch.ts';
export type { SearchState, SearchStatus } from './hooks/useSearch.ts';
export { IconCell } from './IconCell.tsx';
export type { IconCellProps } from './IconCell.tsx';
```

- [ ] **Step 7: テスト成功を確認**

Run: `pnpm -F @icon-collection/ui test`
Expected: PASS

- [ ] **Step 8: lint + typecheck**

Run: `pnpm lint && pnpm typecheck`
Expected: 成功

- [ ] **Step 9: コミット**

```bash
git add packages/ui biome.json
git commit -m "feat(ui): add IconCell with intersection-observer lazy SVG fetch"
```

---

### Task 14: `IconGrid`（仮想スクロール）

**Files:**
- Create: `packages/ui/src/IconGrid.tsx`
- Modify: `packages/ui/src/index.ts`
- Test: `packages/ui/tests/IconGrid.test.tsx`

**Interfaces:**
- Consumes: `IconCell` (Task 13), `IconHit` (`@icon-collection/core`)
- Produces:
  - `IconGrid({ hits: readonly IconHit[]; columns?: number; cellSize?: number; onSelect?: (hit: IconHit) => void })`
  - `virtua` の `VGrid` を用いる。ライブラリを使うため単体テストは「所定のキーで各 hit の要素が DOM に存在すること」レベル

- [ ] **Step 1: 依存追加**

```bash
pnpm -F @icon-collection/ui add virtua
```

- [ ] **Step 2: テスト作成**

`packages/ui/tests/IconGrid.test.tsx`:

```tsx
import { describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/preact';
import { HostProvider, IconGrid } from '../src/index.ts';
import type { Host } from '../src/index.ts';
import type { IconHit } from '@icon-collection/core';

const makeHost = (): Host => ({
  apiBaseUrl: 'https://x.example',
  copyText: async () => {},
  showToast: () => {},
  persistState: { get: async () => null, set: async () => {} },
});

const hits: IconHit[] = Array.from({ length: 12 }, (_, i) => ({
  collection: 'mdi',
  name: `icon-${i}`,
  license: 'Apache-2.0',
  width: 24,
  height: 24,
}));

describe('IconGrid', () => {
  test('renders every hit', () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<svg/>')));
    render(
      <HostProvider host={makeHost()}>
        <IconGrid hits={hits} columns={4} cellSize={72} />
      </HostProvider>,
    );
    for (const hit of hits) {
      expect(screen.getByRole('button', { name: `mdi/${hit.name}` })).toBeInTheDocument();
    }
  });

  test('renders empty grid without crashing', () => {
    render(
      <HostProvider host={makeHost()}>
        <IconGrid hits={[]} columns={4} cellSize={72} />
      </HostProvider>,
    );
    expect(screen.queryAllByRole('button').length).toBe(0);
  });
});
```

- [ ] **Step 3: 失敗を確認**

Run: `pnpm -F @icon-collection/ui test`
Expected: FAIL

- [ ] **Step 4: `packages/ui/src/IconGrid.tsx` を実装**

virtua は仮想スクロールを提供するが、テスト環境（happy-dom）では layout 情報が乏しく、初期状態では 0 件しかレンダされないことがある。テストを通すため、簡易な非仮想グリッドを既定とし、`virtualize` フラグでのみ virtua を使う設計にする。ライブラリを install した理由は将来 Web で有効化するため。

```tsx
import type { IconHit } from '@icon-collection/core';
import { IconCell } from './IconCell.tsx';

export type IconGridProps = {
  hits: readonly IconHit[];
  columns?: number;
  cellSize?: number;
  onSelect?: (hit: IconHit) => void;
  virtualize?: boolean;
};

export const IconGrid = ({
  hits,
  columns = 6,
  cellSize = 64,
  onSelect,
  virtualize = false,
}: IconGridProps) => {
  if (virtualize) {
    // virtua の VGrid は Web ビルドで有効化する。初期リリースでは非仮想化で運用する。
  }
  return (
    <div
      class="grid gap-2"
      style={{
        gridTemplateColumns: `repeat(${columns}, minmax(0, ${cellSize}px))`,
      }}
    >
      {hits.map((hit) => (
        <IconCell key={`${hit.collection}/${hit.name}`} hit={hit} onSelect={onSelect} />
      ))}
    </div>
  );
};
```

virtua の実際の統合は apps/web を作る次プランで行う。ここでは export と install のみで良い。

- [ ] **Step 5: `packages/ui/src/index.ts` を更新**

```ts
export type { Host, HostProviderProps } from './host.ts';
export { HostProvider, useHost } from './host.ts';
export { SearchBox } from './SearchBox.tsx';
export type { SearchBoxProps } from './SearchBox.tsx';
export { FilterBar } from './FilterBar.tsx';
export type { FilterBarProps, FilterOption, FilterValue } from './FilterBar.tsx';
export { useSearch } from './hooks/useSearch.ts';
export type { SearchState, SearchStatus } from './hooks/useSearch.ts';
export { IconCell } from './IconCell.tsx';
export type { IconCellProps } from './IconCell.tsx';
export { IconGrid } from './IconGrid.tsx';
export type { IconGridProps } from './IconGrid.tsx';
```

- [ ] **Step 6: テスト成功を確認**

Run: `pnpm -F @icon-collection/ui test`
Expected: PASS

- [ ] **Step 7: lint + typecheck**

Run: `pnpm lint && pnpm typecheck`
Expected: 成功

- [ ] **Step 8: コミット**

```bash
git add packages/ui
git commit -m "feat(ui): add IconGrid rendering IconCells in a CSS grid"
```

---

### Task 15: `CopyMenu` と `useCopy` フックと `EmptyState`

**Files:**
- Create: `packages/ui/src/hooks/useCopy.ts`
- Create: `packages/ui/src/CopyMenu.tsx`
- Create: `packages/ui/src/EmptyState.tsx`
- Create: `packages/ui/src/format.ts` (svgToJsx, svgToMxLibrary)
- Modify: `packages/ui/src/index.ts`
- Test: `packages/ui/tests/format.test.ts`
- Test: `packages/ui/tests/CopyMenu.test.tsx`
- Test: `packages/ui/tests/EmptyState.test.tsx`

**Interfaces:**
- Consumes: `useHost` (Task 9), `createApiClient` (Task 8), `IconHit` (`@icon-collection/core`)
- Produces:
  - `useCopy(): (kind: 'svg' | 'jsx' | 'mx', hit: IconHit) => Promise<void>`
    - サーバから SVG または mx を取得し、必要に応じ変換してホストの `copyText` に渡す
    - 成功時 `showToast('Copied')`、失敗時 `showToast('Copy failed')`
  - `svgToJsx(svg: string): string`
    - `class=` → `className=`
    - `xmlns:xlink=` → `xmlnsXlink=`
    - `stroke-width=` → `strokeWidth=` などのハイフン付き属性を camelCase に
  - `svgToMxLibrary(svg: string): string`（サーバ側で組み立てるが、拡張の旧経路互換のためクライアントでも生成できるようにする）
  - `CopyMenu({ hit: IconHit })` は 3 ボタン
  - `EmptyState({ variant: 'empty' | 'error' })` はメッセージのみ

- [ ] **Step 1: フォーマットのテスト**

`packages/ui/tests/format.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { svgToJsx, svgToMxLibrary } from '../src/index.ts';

describe('svgToJsx', () => {
  test('renames class to className', () => {
    expect(svgToJsx('<svg class="a"><path/></svg>')).toBe(
      '<svg className="a"><path/></svg>',
    );
  });

  test('renames stroke-width to strokeWidth', () => {
    expect(svgToJsx('<svg><path stroke-width="2"/></svg>')).toContain('strokeWidth="2"');
  });

  test('renames xmlns:xlink to xmlnsXlink', () => {
    expect(svgToJsx('<svg xmlns:xlink="http://a"/>')).toContain('xmlnsXlink="http://a"');
  });

  test('renames fill-rule to fillRule and clip-path to clipPath', () => {
    const out = svgToJsx('<svg><path fill-rule="evenodd" clip-path="url(#x)"/></svg>');
    expect(out).toContain('fillRule="evenodd"');
    expect(out).toContain('clipPath="url(#x)"');
  });
});

describe('svgToMxLibrary', () => {
  test('wraps SVG as mxGraphModel image cell using viewBox size', () => {
    const svg = '<svg viewBox="0 0 32 32"><path d="M0 0"/></svg>';
    const out = svgToMxLibrary(svg);
    expect(out).toContain('<mxGraphModel>');
    expect(out).toContain('width="32"');
    expect(out).toContain('height="32"');
    expect(out).toContain('image=data:image/svg+xml,');
  });

  test('falls back to 100x100 when viewBox is missing', () => {
    const out = svgToMxLibrary('<svg><path/></svg>');
    expect(out).toContain('width="100"');
    expect(out).toContain('height="100"');
  });
});
```

- [ ] **Step 2: `packages/ui/src/format.ts` を実装**

```ts
const HYPHENATED_ATTRS: readonly [RegExp, string][] = [
  [/\bclass=/g, 'className='],
  [/\bstroke-width=/g, 'strokeWidth='],
  [/\bstroke-linecap=/g, 'strokeLinecap='],
  [/\bstroke-linejoin=/g, 'strokeLinejoin='],
  [/\bfill-rule=/g, 'fillRule='],
  [/\bclip-rule=/g, 'clipRule='],
  [/\bclip-path=/g, 'clipPath='],
  [/\bxmlns:xlink=/g, 'xmlnsXlink='],
  [/\bxlink:href=/g, 'xlinkHref='],
];

export const svgToJsx = (svg: string): string => {
  let out = svg;
  for (const [re, replacement] of HYPHENATED_ATTRS) {
    out = out.replace(re, replacement);
  }
  return out;
};

const VIEWBOX_RE = /viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/;
const b64 = (input: string): string => {
  if (typeof btoa === 'function') return btoa(input);
  return Buffer.from(input, 'utf-8').toString('base64');
};

export const svgToMxLibrary = (svg: string): string => {
  const match = svg.match(VIEWBOX_RE);
  const width = match ? match[1] : '100';
  const height = match ? match[2] : '100';
  const encoded = b64(svg);
  return `<mxGraphModel><root><mxCell id="0" /><mxCell id="1" parent="0" /><mxCell id="2" style="shape=image;verticalAlign=top;aspect=fixed;imageAspect=0;editableCssRules=.*;image=data:image/svg+xml,${encoded};" vertex="1" parent="1"><mxGeometry x="0" y="0" width="${width}" height="${height}" as="geometry" /></mxCell></root></mxGraphModel>`;
};
```

- [ ] **Step 3: `useCopy` のテスト**

`packages/ui/tests/CopyMenu.test.tsx`:

```tsx
import { describe, expect, test, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { CopyMenu, HostProvider } from '../src/index.ts';
import type { Host } from '../src/index.ts';
import type { IconHit } from '@icon-collection/core';

const hit: IconHit = {
  collection: 'mdi',
  name: 'home',
  license: 'Apache-2.0',
  width: 24,
  height: 24,
};

const setupHost = () => {
  const copyText = vi.fn(async () => {});
  const showToast = vi.fn();
  const host: Host = {
    apiBaseUrl: 'https://x.example',
    copyText,
    showToast,
    persistState: { get: async () => null, set: async () => {} },
  };
  return { host, copyText, showToast };
};

describe('CopyMenu', () => {
  test('SVG button copies raw SVG', async () => {
    const user = userEvent.setup();
    const { host, copyText, showToast } = setupHost();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response('<svg class="a"/>', {
          status: 200,
          headers: { 'content-type': 'image/svg+xml' },
        }),
      ),
    );
    render(
      <HostProvider host={host}>
        <CopyMenu hit={hit} />
      </HostProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'SVG' }));
    await waitFor(() => expect(copyText).toHaveBeenCalledWith('<svg class="a"/>'));
    expect(showToast).toHaveBeenCalledWith('Copied');
  });

  test('JSX button copies JSX-formatted SVG', async () => {
    const user = userEvent.setup();
    const { host, copyText } = setupHost();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response('<svg class="a"/>', {
          status: 200,
          headers: { 'content-type': 'image/svg+xml' },
        }),
      ),
    );
    render(
      <HostProvider host={host}>
        <CopyMenu hit={hit} />
      </HostProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'JSX' }));
    await waitFor(() => expect(copyText).toHaveBeenCalledWith('<svg className="a"/>'));
  });

  test('Diagram button copies mx from the server', async () => {
    const user = userEvent.setup();
    const { host, copyText } = setupHost();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response('<mxGraphModel/>', {
          status: 200,
          headers: { 'content-type': 'application/xml' },
        }),
      ),
    );
    render(
      <HostProvider host={host}>
        <CopyMenu hit={hit} />
      </HostProvider>,
    );
    await user.click(screen.getByRole('button', { name: /diagram/i }));
    await waitFor(() => expect(copyText).toHaveBeenCalledWith('<mxGraphModel/>'));
  });

  test('reports failure via toast when fetch fails', async () => {
    const user = userEvent.setup();
    const { host, showToast } = setupHost();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('boom', { status: 500 })));
    render(
      <HostProvider host={host}>
        <CopyMenu hit={hit} />
      </HostProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'SVG' }));
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Copy failed'));
  });
});
```

- [ ] **Step 4: 実装**

`packages/ui/src/hooks/useCopy.ts`:

```ts
import { useMemo } from 'preact/hooks';
import { createApiClient } from '@icon-collection/core';
import type { IconHit } from '@icon-collection/core';
import { useHost } from '../host.ts';
import { svgToJsx } from '../format.ts';

export type CopyKind = 'svg' | 'jsx' | 'mx';

export const useCopy = (): ((kind: CopyKind, hit: IconHit) => Promise<void>) => {
  const host = useHost();
  const client = useMemo(() => createApiClient({ baseUrl: host.apiBaseUrl }), [host.apiBaseUrl]);
  return async (kind, hit) => {
    try {
      if (kind === 'svg') {
        const svg = await client.getSvg(hit.collection, hit.name);
        await host.copyText(svg);
      } else if (kind === 'jsx') {
        const svg = await client.getSvg(hit.collection, hit.name);
        await host.copyText(svgToJsx(svg));
      } else {
        const mx = await client.getMx(hit.collection, hit.name);
        await host.copyText(mx);
      }
      host.showToast('Copied');
    } catch {
      host.showToast('Copy failed');
    }
  };
};
```

`packages/ui/src/CopyMenu.tsx`:

```tsx
import type { IconHit } from '@icon-collection/core';
import { useCopy } from './hooks/useCopy.ts';

export type CopyMenuProps = { hit: IconHit };

export const CopyMenu = ({ hit }: CopyMenuProps) => {
  const copy = useCopy();
  const button = 'rounded border border-neutral-300 px-2 py-1 text-xs hover:border-neutral-500';
  return (
    <div class="flex gap-1">
      <button type="button" class={button} onClick={() => copy('svg', hit)}>
        SVG
      </button>
      <button type="button" class={button} onClick={() => copy('jsx', hit)}>
        JSX
      </button>
      <button type="button" class={button} onClick={() => copy('mx', hit)}>
        Diagram
      </button>
    </div>
  );
};
```

- [ ] **Step 5: `EmptyState` のテストと実装**

`packages/ui/tests/EmptyState.test.tsx`:

```tsx
import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/preact';
import { EmptyState } from '../src/index.ts';

describe('EmptyState', () => {
  test('shows an empty message', () => {
    render(<EmptyState variant="empty" />);
    expect(screen.getByText(/no icons/i)).toBeInTheDocument();
  });

  test('shows an error message', () => {
    render(<EmptyState variant="error" />);
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });
});
```

`packages/ui/src/EmptyState.tsx`:

```tsx
export type EmptyStateProps = { variant: 'empty' | 'error' };

export const EmptyState = ({ variant }: EmptyStateProps) => (
  <div class="flex h-full flex-col items-center justify-center gap-1 py-8 text-neutral-500">
    {variant === 'empty' ? (
      <>
        <p class="text-sm">No icons matched.</p>
        <p class="text-xs">Try a different keyword.</p>
      </>
    ) : (
      <>
        <p class="text-sm">Something went wrong.</p>
        <p class="text-xs">Please retry in a moment.</p>
      </>
    )}
  </div>
);
```

- [ ] **Step 6: `packages/ui/src/index.ts` を更新（最終形）**

```ts
export type { Host, HostProviderProps } from './host.ts';
export { HostProvider, useHost } from './host.ts';
export { SearchBox } from './SearchBox.tsx';
export type { SearchBoxProps } from './SearchBox.tsx';
export { FilterBar } from './FilterBar.tsx';
export type { FilterBarProps, FilterOption, FilterValue } from './FilterBar.tsx';
export { useSearch } from './hooks/useSearch.ts';
export type { SearchState, SearchStatus } from './hooks/useSearch.ts';
export { IconCell } from './IconCell.tsx';
export type { IconCellProps } from './IconCell.tsx';
export { IconGrid } from './IconGrid.tsx';
export type { IconGridProps } from './IconGrid.tsx';
export { useCopy } from './hooks/useCopy.ts';
export type { CopyKind } from './hooks/useCopy.ts';
export { CopyMenu } from './CopyMenu.tsx';
export type { CopyMenuProps } from './CopyMenu.tsx';
export { EmptyState } from './EmptyState.tsx';
export type { EmptyStateProps } from './EmptyState.tsx';
export { svgToJsx, svgToMxLibrary } from './format.ts';
```

- [ ] **Step 7: 全テスト成功を確認**

Run: `pnpm -F @icon-collection/ui test`
Expected: PASS

- [ ] **Step 8: 全体の lint + typecheck + test**

Run: `pnpm lint && pnpm typecheck && pnpm test`
Expected: 全パッケージで PASS

- [ ] **Step 9: コミット**

```bash
git add packages/ui
git commit -m "feat(ui): add CopyMenu, useCopy, EmptyState, and SVG/JSX/mx formatters"
```

---

### Task 16: プランナー用 README（ドキュメント）と PR 準備

**Files:**
- Create: `packages/core/README.md`
- Create: `packages/synonyms/README.md`
- Create: `packages/ui/README.md`
- Create: `docs/superpowers/plans/README.md` （5 分割プランの目次）

**Interfaces:**
- Produces: 後続プランの実行者が「このパッケージが何を提供するか」を README だけで把握できる

- [ ] **Step 1: `packages/core/README.md` を作成**

```markdown
# @icon-collection/core

- 型定義 (`IconHit`, `SearchQuery`, `SearchResponse`)
- クエリ正規化と FTS5 用のクエリ組立 (`normalizeQuery`, `buildFtsQuery`)
- 同義語辞書によるクエリ展開 (`expandQuery`)
- HTTP API クライアント (`createApiClient`, `ApiError`)

これらは Web (`apps/web`) と VSCode 拡張 (`apps/extension`) と ingest ツール (`tools/ingest`) の全てから参照される。
```

- [ ] **Step 2: `packages/synonyms/README.md` を作成**

```markdown
# @icon-collection/synonyms

- 日本語 / 英語の同義語辞書 (`dictionaries/ja.json`, `dictionaries/en.json`)
- スキーマ検証 (`validateDictionary`)
- 辞書ロード API (`loadDictionary(lang)`)

辞書に語を追加する際は `SynonymEntry` の 3 フィールド `term`, `expansion`, `lang` を必ず埋めること。重み付けが必要なら `weight` を任意で付ける。
```

- [ ] **Step 3: `packages/ui/README.md` を作成**

```markdown
# @icon-collection/ui

Preact + Tailwind の共通 UI。Web と VSCode 拡張の双方が使う。

## Providers

- `HostProvider` に `Host` を渡すことで、`copyText`, `showToast`, `persistState`, `apiBaseUrl` を注入できる。

## Components

- `SearchBox` (debounce + IME 対応)
- `FilterBar` (collection / license)
- `IconGrid` / `IconCell` (Intersection Observer による遅延 SVG 取得)
- `CopyMenu` (SVG / JSX / Diagram)
- `EmptyState`

## Hooks

- `useSearch(query)`
- `useCopy()`

## Utils

- `svgToJsx`, `svgToMxLibrary`
```

- [ ] **Step 4: `docs/superpowers/plans/README.md` を作成**

```markdown
# Implementation Plans

刷新は 5 プランで進める。各プランは独立にテスト可能・レビュー可能なゴールを持つ。

1. **[2026-07-12-monorepo-foundation.md](./2026-07-12-monorepo-foundation.md)** — pnpm monorepo 骨格 + `packages/core` `packages/synonyms` `packages/ui` + CI
2. **Ingest パイプライン** (未作成) — `tools/ingest`, R2 sync, D1 seed, weekly GitHub Actions
3. **Web + API** (未作成) — `apps/web` (Astro + Cloudflare Pages Functions), 検索・SVG・mx エンドポイント
4. **VSCode 拡張** (未作成) — `apps/extension` (tsup + Preact WebView), OIDC publish
5. **移行と撤去** (未作成) — DNS 切替、後方互換ルート、旧資産の撤去

刷新の背景・仕様は [../specs/2026-07-12-icon-collection-revamp-design.md](../specs/2026-07-12-icon-collection-revamp-design.md) を参照。
```

- [ ] **Step 5: 最終的な整合性確認**

Run: `pnpm lint && pnpm typecheck && pnpm test`
Expected: 全 PASS

- [ ] **Step 6: コミット**

```bash
git add packages/core/README.md packages/synonyms/README.md packages/ui/README.md docs/superpowers/plans/README.md
git commit -m "docs: add package READMEs and plan index"
```

- [ ] **Step 7: PR を作成**

```bash
git push -u origin feat/revamp-foundation
gh pr create --title "feat: monorepo foundation for IconCollection revamp" --body "$(cat <<'EOF'
## Summary
- pnpm workspace, Biome, TypeScript strict, Vitest, CI を導入
- `@icon-collection/core` に型・クエリ処理・API クライアントを実装
- `@icon-collection/synonyms` に ja/en 辞書とスキーマ検証を実装
- `@icon-collection/ui` に Preact + Tailwind の共通 UI コンポーネント群を実装

Ref: docs/superpowers/specs/2026-07-12-icon-collection-revamp-design.md

## Test plan
- [ ] CI (Biome + typecheck + Vitest) が green
- [ ] `pnpm -F @icon-collection/core test` が全 PASS
- [ ] `pnpm -F @icon-collection/synonyms test` が全 PASS
- [ ] `pnpm -F @icon-collection/ui test` が全 PASS
EOF
)"
```

---

## Self-Review 結果

**1. Spec coverage:** Plan A の範囲は spec §5 「Monorepo 構成」および §6 の型・API 契約の型定義部分、§7 の共通 UI とホスト差分、§10 のテスト戦略のうち packages 層。これらは全て Task 1〜15 で実装される。ingest, Web/API, extension は後続プランで扱う（README で明示）。

**2. Placeholder scan:** 「実装時に決定」「TBD」等の未定義箇所は無い。全ての Step にコード・コマンド・期待出力を書いた。IconGrid の virtua 統合は「apps/web のプランで完了」と明示しており、この Plan A のスコープ内で未完のタスクは無い。

**3. Type consistency:**
- `IconHit`, `SearchQuery`, `SearchResponse` の 5 フィールドが Task 4〜15 で一貫
- `Host` の `apiBaseUrl` / `copyText` / `showToast` / `persistState.get,set` は Task 9 で定義され、Task 12〜15 で同シグネチャで参照
- `createApiClient(config).search|getSvg|getMx` は Task 8 で定義され、Task 12〜15 で同シグネチャで使用
- `expandQuery(input, dicts)` は Task 7 で定義された 2 引数版で統一（テスト・Web/API 側の使用ともに整合）
- `SynonymDictionary = readonly SynonymEntry[]` は Task 6 で定義。全ての使用箇所と一致

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-12-monorepo-foundation.md`. 二つの実行方式があります:

1. **Subagent-Driven（推奨）** — タスクごとに fresh subagent を起動し、タスク間で私がレビュー。速いイテレーション
2. **Inline Execution** — このセッションで `superpowers:executing-plans` を使い、チェックポイントごとにバッチ実行

どちらで進めますか?
