# VSCode Extension Implementation Plan (Plan D)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 既存 `extension/` (v0.1.2) を破棄し、`apps/vscode-extension/` に置き換える。Preact + `packages/ui` の Host interface で WebView を実装、Plan C の `/api/search` を使う。Publish は Azure OIDC 経由。

**Architecture:** tsup で 2 バンドル (extension host = Node, webview = browser)。WebView は `packages/ui/HostProvider` を再利用し、Host 実装だけ差し替え (`vscode-host.ts`)。CSP + nonce 付き HTML を extension host が生成、`postMessage` で clipboard / toast / persistState を橋渡し。

**Tech Stack:** TypeScript strict + tsup + Vitest 4 + Preact 10 + Tailwind CSS v4 + `@vscode/vsce` + Azure OIDC + Biome 2

## Global Constraints

- Node 22 LTS / pnpm 9 / TypeScript strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `allowImportingTsExtensions`, `noImplicitOverride`)
- Bundler: tsup / Test: Vitest 4 (+ `@vscode/test-electron` for activation) / Lint & Format: Biome 2
- 依存バージョンは `pnpm add` 経由、package.json ハードコード禁止
- linter-ignore directive (`@ts-ignore` / `@biome-ignore` など) 禁止 — 設計で解消
- 旧 Algolia app ID / API key の残骸を新コードに残さない (旧 `extension/` は Plan E で削除)
- Extension `version`: `0.2.0`
- Publisher: `kage1020`、name: `icon-collection` (既存 Marketplace と連続)
- WebView CSP: `default-src 'none'; script-src 'nonce-{RANDOM}'; style-src 'unsafe-inline'; connect-src ${apiBaseUrl}; img-src data: ${apiBaseUrl}; font-src data:;`
- Extension setting: `iconCollection.apiBaseUrl` (default `https://icons.kage1020.com`)、`iconCollection.defaultLimit` (default 60、max 200)

---

### Task 1: `apps/vscode-extension/` scaffold + package.json

**Files:**
- Create: `apps/vscode-extension/package.json`
- Create: `apps/vscode-extension/CHANGELOG.md`
- Create: `apps/vscode-extension/.vscodeignore`
- Create: `apps/vscode-extension/images/icon.png` (旧 `extension/images/icon.png` をコピー)
- Create: `apps/vscode-extension/images/icon.svg` (旧 `extension/images/icon.svg` をコピー)
- Create: `apps/vscode-extension/tsconfig.json` (extension host 用)
- Create: `apps/vscode-extension/tsconfig.webview.json` (webview 用、DOM lib あり)

**Interfaces:**
- Consumes: 旧 `extension/CHANGELOG.md` の履歴 + images/*
- Produces: 新 workspace `icon-collection`。以降のタスクで `src/` と `tests/` を埋める

- [ ] **Step 1: images をコピー**

```bash
mkdir -p apps/vscode-extension/images
cp extension/images/icon.png extension/images/icon.svg apps/vscode-extension/images/
```

- [ ] **Step 2: package.json 作成 (hand-authored scripts + metadata only、deps は次 step の `pnpm add` で埋まる)**

```json
{
  "name": "icon-collection",
  "displayName": "Icon Collection",
  "description": "Viewer of icon library with SVG.",
  "version": "0.2.0",
  "private": false,
  "type": "module",
  "publisher": "kage1020",
  "license": "Apache-2.0",
  "repository": {
    "type": "git",
    "url": "https://github.com/kage1020/IconCollection"
  },
  "engines": {
    "node": ">=22",
    "vscode": "^1.87.0"
  },
  "categories": ["Other"],
  "activationEvents": [],
  "main": "./dist/extension.cjs",
  "icon": "./images/icon.png",
  "contributes": {
    "views": {
      "IconCollection": [
        {
          "type": "webview",
          "id": "iconCollection.IconCollection",
          "name": "Icon Collection"
        }
      ]
    },
    "viewsContainers": {
      "activitybar": [
        {
          "id": "IconCollection",
          "title": "Icon Collection",
          "icon": "./images/icon.svg"
        }
      ]
    },
    "configuration": {
      "title": "Icon Collection",
      "properties": {
        "iconCollection.apiBaseUrl": {
          "type": "string",
          "default": "https://icons.kage1020.com",
          "description": "Base URL of the Icon Collection API (search + icon delivery)."
        },
        "iconCollection.defaultLimit": {
          "type": "number",
          "default": 60,
          "minimum": 1,
          "maximum": 200,
          "description": "Number of icons to fetch per search request."
        }
      }
    }
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "vscode:prepublish": "pnpm run build",
    "package": "vsce package --no-dependencies",
    "typecheck": "tsc -p tsconfig.json --noEmit && tsc -p tsconfig.webview.json --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:integration": "vscode-test"
  }
}
```

- [ ] **Step 3: 依存 install (pnpm CLI 経由、バージョンハードコード禁止)**

```bash
pnpm -F icon-collection add preact
pnpm -F icon-collection add -D \
  @icon-collection/core@workspace:^ \
  @icon-collection/synonyms@workspace:^ \
  @icon-collection/ui@workspace:^ \
  @types/node \
  @types/vscode \
  @vscode/test-cli \
  @vscode/test-electron \
  @vscode/vsce \
  happy-dom \
  tsup \
  typescript \
  vitest
```

- [ ] **Step 4: `.vscodeignore` 作成**

```
.vscode/**
.vscode-test/**
tests/**
tsup.config.ts
tsconfig*.json
vitest.config.ts
src/**
!dist/**
node_modules/**
.gitignore
.npmignore
CHANGELOG.md
!CHANGELOG.md
```

- [ ] **Step 5: tsconfig 2 種**

```json
// apps/vscode-extension/tsconfig.json (extension host: Node target)
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "Node",
    "target": "ES2022",
    "lib": ["ES2022"],
    "types": ["node", "vscode"],
    "outDir": "dist",
    "verbatimModuleSyntax": false
  },
  "include": ["src/extension.ts", "src/host-adapter.ts", "tests/extension.test.ts"]
}
```

`verbatimModuleSyntax` を extension host 側で `false` にする理由: `vscode` は CommonJS-only の require ベースモジュールで、`import type` を強制すると tsup が正しく解決できない。webview 側は strict のまま。

```json
// apps/vscode-extension/tsconfig.webview.json (browser target)
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": [],
    "jsx": "preserve",
    "jsxImportSource": "preact",
    "outDir": "dist/webview"
  },
  "include": ["src/webview/**/*", "tests/webview-host.test.ts"]
}
```

- [ ] **Step 6: CHANGELOG.md 更新 (旧履歴を新 workspace にコピー、0.2.0 エントリ追加)**

`extension/CHANGELOG.md` の内容をコピーし、先頭に:

```markdown
## 0.2.0

- Complete rewrite: Preact-based WebView with hydrated `packages/ui` components
- Search backend switched from Algolia to the new Icon Collection API
- Configurable API endpoint via `iconCollection.apiBaseUrl`
- Build: webpack → tsup, Node 22 required, VSCode Engine unchanged
```

- [ ] **Step 7: workspace で認識されることを検証**

```bash
pnpm install
pnpm -F icon-collection typecheck
```

Expected: `pnpm-workspace.yaml` の `apps/*` により自動で workspace 認識、typecheck は src/ 空でも `include` 内ファイル 0 で warning のみ (エラーなし)。

- [ ] **Step 8: commit**

```bash
git add apps/vscode-extension pnpm-lock.yaml
git commit -m "chore(vscode-extension): scaffold apps/vscode-extension workspace"
```

---

### Task 2: tsup config (2 entry: extension + webview)

**Files:**
- Create: `apps/vscode-extension/tsup.config.ts`

**Interfaces:**
- Produces:
  - `dist/extension.cjs` (Node CJS、`vscode` は external)
  - `dist/webview/main.js` (browser ESM、Preact + `packages/ui` を bundle)
  - `dist/webview/main.css` (Tailwind + `@icon-collection/ui/styles.css` を bundle)

- [ ] **Step 1: tsup.config.ts**

```typescript
import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: { extension: 'src/extension.ts' },
    format: ['cjs'],
    platform: 'node',
    target: 'node22',
    external: ['vscode'],
    sourcemap: true,
    clean: true,
    outDir: 'dist',
  },
  {
    entry: { main: 'src/webview/main.tsx' },
    format: ['esm'],
    platform: 'browser',
    target: 'es2022',
    sourcemap: true,
    outDir: 'dist/webview',
    esbuildOptions(options) {
      options.jsx = 'automatic';
      options.jsxImportSource = 'preact';
    },
    loader: { '.css': 'copy' },
  },
]);
```

Tailwind の統合は `@tailwindcss/vite` が tsup に直接載らないため、Task 3 で `src/webview/main.tsx` から `@icon-collection/ui/styles.css` を import することで esbuild の CSS bundling を発火させる。追加でプロジェクト固有のスタイルが必要なら `src/webview/main.css` を作って import する。

- [ ] **Step 2: build 実行 (src/ 未実装なので空エントリで failure OK — Task 3 以降で埋める。ここでは config だけ commit する)**

```bash
pnpm -F icon-collection build 2>&1 | head -20
```

Expected: `src/extension.ts` / `src/webview/main.tsx` 不在で ENOENT。想定内。次タスクで解消。

- [ ] **Step 3: commit (build 未成功のまま commit する)**

```bash
git add apps/vscode-extension/tsup.config.ts
git commit -m "build(vscode-extension): configure tsup with dual entry"
```

---

### Task 3: `src/webview/vscode-host.ts` — WebView 側 Host 実装

**Files:**
- Create: `apps/vscode-extension/src/webview/vscode-host.ts`
- Create: `apps/vscode-extension/tests/webview-host.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export type VsCodeApi = {
    postMessage: (msg: unknown) => void;
    getState: () => unknown;
    setState: (state: unknown) => void;
  };
  export type InitPayload = { apiBaseUrl: string; defaultLimit: number };
  export const createVscodeHost = (input: {
    vscode: VsCodeApi;
    init: InitPayload;
    subscribeToMessages: (handler: (msg: unknown) => void) => () => void;
  }): Host;  // Host from @icon-collection/ui
  ```
- Consumes: `@icon-collection/ui` の `Host` 型と `createSvgCache`、`@icon-collection/core` の `createApiClient`

- [ ] **Step 1: 失敗するテストを書く**

```typescript
// apps/vscode-extension/tests/webview-host.test.ts
import { describe, expect, it, vi } from 'vitest';
import { createVscodeHost } from '../src/webview/vscode-host.ts';

const makeVscode = () => ({ postMessage: vi.fn(), getState: () => null, setState: vi.fn() });

describe('createVscodeHost', () => {
  it('routes copyText through postMessage', async () => {
    const vscode = makeVscode();
    const host = createVscodeHost({
      vscode,
      init: { apiBaseUrl: 'https://x.test', defaultLimit: 60 },
      subscribeToMessages: () => () => undefined,
    });
    await host.copyText('<svg/>');
    expect(vscode.postMessage).toHaveBeenCalledWith({ type: 'copyText', text: '<svg/>' });
  });

  it('routes showToast through postMessage', () => {
    const vscode = makeVscode();
    const host = createVscodeHost({
      vscode,
      init: { apiBaseUrl: 'https://x.test', defaultLimit: 60 },
      subscribeToMessages: () => () => undefined,
    });
    host.showToast('Copied');
    expect(vscode.postMessage).toHaveBeenCalledWith({ type: 'showToast', message: 'Copied' });
  });

  it('resolves persistState.get from inbound persistGetResult message', async () => {
    const vscode = makeVscode();
    let handler: ((msg: unknown) => void) | null = null;
    const host = createVscodeHost({
      vscode,
      init: { apiBaseUrl: 'https://x.test', defaultLimit: 60 },
      subscribeToMessages: (h) => {
        handler = h;
        return () => undefined;
      },
    });
    const pending = host.persistState.get('theQuery');
    expect(vscode.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'persistGet', key: 'theQuery' }),
    );
    const call = vscode.postMessage.mock.calls[0]![0] as { requestId: string };
    handler!({ type: 'persistGetResult', requestId: call.requestId, value: 'stored' });
    expect(await pending).toBe('stored');
  });

  it('sends persistSet immediately', async () => {
    const vscode = makeVscode();
    const host = createVscodeHost({
      vscode,
      init: { apiBaseUrl: 'https://x.test', defaultLimit: 60 },
      subscribeToMessages: () => () => undefined,
    });
    await host.persistState.set('lastQ', 'home');
    expect(vscode.postMessage).toHaveBeenCalledWith({ type: 'persistSet', key: 'lastQ', value: 'home' });
  });

  it('exposes apiBaseUrl and constructs apiClient / svgCache', () => {
    const vscode = makeVscode();
    const host = createVscodeHost({
      vscode,
      init: { apiBaseUrl: 'https://x.test', defaultLimit: 60 },
      subscribeToMessages: () => () => undefined,
    });
    expect(host.apiBaseUrl).toBe('https://x.test');
    expect(typeof host.apiClient.search).toBe('function');
    expect(host.svgCache.size).toBe(0);
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `pnpm -F icon-collection test`
Expected: `createVscodeHost` 未実装で全 5 fail。

- [ ] **Step 3: 実装**

```typescript
// apps/vscode-extension/src/webview/vscode-host.ts
import { createApiClient } from '@icon-collection/core';
import { createSvgCache } from '@icon-collection/ui';
import type { Host } from '@icon-collection/ui';

export type VsCodeApi = {
  postMessage: (msg: unknown) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
};

export type InitPayload = { apiBaseUrl: string; defaultLimit: number };

export type CreateVscodeHostInput = {
  vscode: VsCodeApi;
  init: InitPayload;
  subscribeToMessages: (handler: (msg: unknown) => void) => () => void;
};

type PersistGetResult = { type: 'persistGetResult'; requestId: string; value: string | null };

const isPersistGetResult = (msg: unknown): msg is PersistGetResult =>
  typeof msg === 'object' &&
  msg !== null &&
  (msg as { type?: unknown }).type === 'persistGetResult' &&
  typeof (msg as { requestId?: unknown }).requestId === 'string';

export const createVscodeHost = (input: CreateVscodeHostInput): Host => {
  const pending = new Map<string, (value: string | null) => void>();
  input.subscribeToMessages((msg) => {
    if (!isPersistGetResult(msg)) return;
    const resolve = pending.get(msg.requestId);
    if (!resolve) return;
    pending.delete(msg.requestId);
    resolve(msg.value);
  });

  let counter = 0;
  const nextRequestId = (): string => `req-${++counter}`;

  return {
    apiBaseUrl: input.init.apiBaseUrl,
    apiClient: createApiClient({ baseUrl: input.init.apiBaseUrl }),
    svgCache: createSvgCache(),
    copyText: async (text) => {
      input.vscode.postMessage({ type: 'copyText', text });
    },
    showToast: (message) => {
      input.vscode.postMessage({ type: 'showToast', message });
    },
    persistState: {
      get: async (key) => {
        const requestId = nextRequestId();
        const promise = new Promise<string | null>((resolve) => pending.set(requestId, resolve));
        input.vscode.postMessage({ type: 'persistGet', requestId, key });
        return promise;
      },
      set: async (key, value) => {
        input.vscode.postMessage({ type: 'persistSet', key, value });
      },
    },
  };
};
```

- [ ] **Step 4: テスト green を確認**

Run: `pnpm -F icon-collection test`
Expected: 5 passing。

- [ ] **Step 5: typecheck / lint**

Run: `pnpm -F icon-collection typecheck && pnpm lint`
Expected: clean。

- [ ] **Step 6: commit**

```bash
git add apps/vscode-extension/src apps/vscode-extension/tests
git commit -m "feat(vscode-extension): implement WebView host bridge"
```

---

### Task 4: `src/webview/main.tsx` — Preact entry + SearchPage 移植

**Files:**
- Create: `apps/vscode-extension/src/webview/main.tsx`
- Create: `apps/vscode-extension/src/webview/main.css` (Tailwind import)
- Create: `apps/vscode-extension/src/webview/SearchPage.tsx` (`apps/web/src/islands/SearchPage.tsx` からコピーして Host を差し替え)
- Create: `apps/vscode-extension/src/webview/ToastHost.tsx` (`apps/web/src/islands/ToastHost.tsx` そのままコピー — extension 側では postMessage が担うため toast は表示しないが SearchPage の依存として残す。または SearchPage から削除)

**Interfaces:**
- Consumes: `createVscodeHost` (Task 3)、`packages/ui` の `HostProvider` / `SearchBox` / `FilterBar` / `IconGrid` / `CopyMenu` / `useSearch`
- Produces: `dist/webview/main.js` に bundle される Preact hydration エントリ

- [ ] **Step 1: main.css**

```css
@import "tailwindcss";
@import "@icon-collection/ui/styles.css";
```

- [ ] **Step 2: SearchPage コピー**

`apps/web/src/islands/SearchPage.tsx` を `apps/vscode-extension/src/webview/SearchPage.tsx` にコピーし、`useHost` factory を削除して props で受け取る:

```tsx
// apps/vscode-extension/src/webview/SearchPage.tsx (diff from apps/web version)
// (a) useHost / createApiClient / createSvgCache などの import を削除
// (b) SearchPageProps: { host: Host } に変更
// (c) SearchPage は const SearchPage = ({ host }: { host: Host }) => (
//       <HostProvider host={host}><SearchInner /><ToastHost /></HostProvider>
//     );
// (d) ToastHost は不要 (extension host が showInformationMessage を出すため) だが、
//     残しておいて postMessage 経由で toast 未実装の場合の fallback 表示にも使える。
//     この plan では SearchPage 内で <ToastHost /> を「保持しない」判断で削除する。
```

具体的な出力 (置換後):

```tsx
import type { Host } from '@icon-collection/ui';
import type { SearchQuery } from '@icon-collection/core';
import {
  FilterBar,
  HostProvider,
  IconGrid,
  SearchBox,
  useSearch,
} from '@icon-collection/ui';
import type { FilterValue } from '@icon-collection/ui';
import { useEffect, useState } from 'preact/hooks';
import { CopyMenu } from '@icon-collection/ui';
import type { IconHit } from '@icon-collection/core';

const COLLECTION_OPTIONS = [
  { name: 'mdi', label: 'MDI' },
  { name: 'lucide', label: 'Lucide' },
  { name: 'heroicons', label: 'Heroicons' },
  { name: 'tabler', label: 'Tabler' },
] as const;

const LICENSE_OPTIONS = ['Apache-2.0', 'MIT', 'ISC', 'CC-BY-4.0'] as const;

const SearchInner = ({ defaultLimit }: { defaultLimit: number }) => {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<FilterValue>({ collection: [], license: [] });
  const [selectedHit, setSelectedHit] = useState<IconHit | null>(null);
  const query: SearchQuery | null = q.trim()
    ? {
        q,
        ...(filter.collection.length > 0 ? { collection: filter.collection } : {}),
        ...(filter.license.length > 0 ? { license: filter.license } : {}),
        limit: defaultLimit,
      }
    : null;
  const state = useSearch(query);
  useEffect(() => setSelectedHit(null), [q, filter]);
  return (
    <div class="flex flex-col gap-4 p-3">
      <SearchBox initialValue={q} onChange={setQ} placeholder="Search icons…" />
      <FilterBar
        collections={COLLECTION_OPTIONS}
        licenses={LICENSE_OPTIONS}
        value={filter}
        onChange={setFilter}
      />
      {state.status === 'error' ? (
        <p class="text-red-600">Error: {state.error?.message}</p>
      ) : (
        <IconGrid hits={state.data?.hits ?? []} onSelect={setSelectedHit} />
      )}
      {selectedHit && (
        <div class="flex flex-col gap-2 rounded border border-neutral-200 p-2">
          <div class="flex items-center justify-between text-xs">
            <span>{selectedHit.collection}/{selectedHit.name}</span>
            <button type="button" class="text-neutral-500 hover:text-neutral-800" onClick={() => setSelectedHit(null)}>
              Close
            </button>
          </div>
          <CopyMenu hit={selectedHit} />
        </div>
      )}
    </div>
  );
};

export type SearchPageProps = { host: Host; defaultLimit: number };

export const SearchPage = ({ host, defaultLimit }: SearchPageProps) => (
  <HostProvider host={host}>
    <SearchInner defaultLimit={defaultLimit} />
  </HostProvider>
);
```

- [ ] **Step 3: main.tsx**

```tsx
// apps/vscode-extension/src/webview/main.tsx
import { render } from 'preact';
import { createVscodeHost, type InitPayload, type VsCodeApi } from './vscode-host.ts';
import { SearchPage } from './SearchPage.tsx';
import './main.css';

declare global {
  interface Window {
    acquireVsCodeApi: () => VsCodeApi;
  }
}

const vscode = window.acquireVsCodeApi();
const messageHandlers = new Set<(msg: unknown) => void>();
window.addEventListener('message', (event) => {
  for (const handler of messageHandlers) handler(event.data);
});

const initReady = new Promise<InitPayload>((resolve) => {
  const initHandler = (msg: unknown): void => {
    if (
      typeof msg === 'object' &&
      msg !== null &&
      (msg as { type?: unknown }).type === 'init'
    ) {
      messageHandlers.delete(initHandler);
      resolve(msg as InitPayload & { type: 'init' });
    }
  };
  messageHandlers.add(initHandler);
});

vscode.postMessage({ type: 'ready' });

initReady.then((init) => {
  const host = createVscodeHost({
    vscode,
    init,
    subscribeToMessages: (handler) => {
      messageHandlers.add(handler);
      return () => {
        messageHandlers.delete(handler);
      };
    },
  });
  const root = document.getElementById('root');
  if (!root) throw new Error('#root not found');
  render(<SearchPage host={host} defaultLimit={init.defaultLimit} />, root);
});
```

- [ ] **Step 4: build 通過確認**

Run: `pnpm -F icon-collection build`
Expected: `dist/extension.cjs` は Task 5 まで未実装で fail する可能性あり。webview だけビルドしたい場合は tsup に entry filter がないので、ここでは失敗 OK。

Step-by-step で:
- `dist/webview/main.js` と `dist/webview/main.css` が生成されている
- extension.cjs 部分は "src/extension.ts not found" で fail — Task 5 で解消

- [ ] **Step 5: commit**

```bash
git add apps/vscode-extension/src/webview
git commit -m "feat(vscode-extension): implement WebView Preact entry"
```

---

### Task 5: `src/host-adapter.ts` + `src/extension.ts` — Extension host

**Files:**
- Create: `apps/vscode-extension/src/host-adapter.ts`
- Create: `apps/vscode-extension/src/extension.ts`
- Create: `apps/vscode-extension/tests/host-adapter.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export type ExtensionHost = {
    handleCopyText: (text: string) => Promise<void>;
    handleShowToast: (message: string, severity?: 'info' | 'error') => void;
    handlePersistGet: (requestId: string, key: string) => { type: 'persistGetResult'; requestId: string; value: string | null };
    handlePersistSet: (key: string, value: string) => void;
    getInitPayload: () => { apiBaseUrl: string; defaultLimit: number };
  };
  export const createExtensionHost = (deps: {
    globalState: { get: (k: string) => string | null | undefined; update: (k: string, v: string) => Thenable<void> };
    clipboard: { writeText: (s: string) => Thenable<void> };
    ui: { showInformationMessage: (m: string) => void; showErrorMessage: (m: string) => void };
    config: { get: <T>(section: string, defaultValue: T) => T };
  }): ExtensionHost;
  ```

- [ ] **Step 1: 失敗するテストを書く**

```typescript
// apps/vscode-extension/tests/host-adapter.test.ts
import { describe, expect, it, vi } from 'vitest';
import { createExtensionHost } from '../src/host-adapter.ts';

const makeDeps = () => {
  const store = new Map<string, string>();
  return {
    globalState: {
      get: vi.fn((k: string) => store.get(k) ?? null),
      update: vi.fn(async (k: string, v: string) => {
        store.set(k, v);
      }),
    },
    clipboard: { writeText: vi.fn(async (_s: string) => undefined) },
    ui: { showInformationMessage: vi.fn(), showErrorMessage: vi.fn() },
    config: { get: vi.fn(<T>(_section: string, defaultValue: T) => defaultValue) },
  };
};

describe('createExtensionHost', () => {
  it('writes clipboard and shows info toast on copyText', async () => {
    const deps = makeDeps();
    const host = createExtensionHost(deps);
    await host.handleCopyText('<svg/>');
    expect(deps.clipboard.writeText).toHaveBeenCalledWith('<svg/>');
    expect(deps.ui.showInformationMessage).toHaveBeenCalledWith('Copied');
  });

  it('showToast routes info by default, error when specified', () => {
    const deps = makeDeps();
    const host = createExtensionHost(deps);
    host.handleShowToast('done');
    host.handleShowToast('boom', 'error');
    expect(deps.ui.showInformationMessage).toHaveBeenCalledWith('done');
    expect(deps.ui.showErrorMessage).toHaveBeenCalledWith('boom');
  });

  it('persist get/set uses globalState', async () => {
    const deps = makeDeps();
    const host = createExtensionHost(deps);
    host.handlePersistSet('q', 'home');
    expect(deps.globalState.update).toHaveBeenCalledWith('q', 'home');
    const result = host.handlePersistGet('req-1', 'q');
    // handlePersistGet is synchronous read after set (globalState is in-memory here)
    expect(result).toEqual({ type: 'persistGetResult', requestId: 'req-1', value: 'home' });
  });

  it('getInitPayload reads settings with defaults', () => {
    const deps = makeDeps();
    deps.config.get.mockImplementation(<T>(section: string, defaultValue: T) => {
      if (section === 'iconCollection.apiBaseUrl') return 'https://custom' as T;
      if (section === 'iconCollection.defaultLimit') return 100 as T;
      return defaultValue;
    });
    const host = createExtensionHost(deps);
    expect(host.getInitPayload()).toEqual({ apiBaseUrl: 'https://custom', defaultLimit: 100 });
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `pnpm -F icon-collection test`
Expected: 4 fail (`createExtensionHost` 未実装)。

- [ ] **Step 3: 実装 host-adapter.ts**

```typescript
// apps/vscode-extension/src/host-adapter.ts
export type ExtensionHostDeps = {
  globalState: {
    get: (key: string) => string | null | undefined;
    update: (key: string, value: string) => Thenable<void>;
  };
  clipboard: { writeText: (s: string) => Thenable<void> };
  ui: {
    showInformationMessage: (m: string) => void;
    showErrorMessage: (m: string) => void;
  };
  config: {
    get: <T>(section: string, defaultValue: T) => T;
  };
};

export type PersistGetResult = { type: 'persistGetResult'; requestId: string; value: string | null };

export type ExtensionHost = {
  handleCopyText: (text: string) => Promise<void>;
  handleShowToast: (message: string, severity?: 'info' | 'error') => void;
  handlePersistGet: (requestId: string, key: string) => PersistGetResult;
  handlePersistSet: (key: string, value: string) => void;
  getInitPayload: () => { apiBaseUrl: string; defaultLimit: number };
};

export const createExtensionHost = (deps: ExtensionHostDeps): ExtensionHost => ({
  handleCopyText: async (text) => {
    await deps.clipboard.writeText(text);
    deps.ui.showInformationMessage('Copied');
  },
  handleShowToast: (message, severity) => {
    if (severity === 'error') deps.ui.showErrorMessage(message);
    else deps.ui.showInformationMessage(message);
  },
  handlePersistGet: (requestId, key) => ({
    type: 'persistGetResult',
    requestId,
    value: deps.globalState.get(key) ?? null,
  }),
  handlePersistSet: (key, value) => {
    void deps.globalState.update(key, value);
  },
  getInitPayload: () => ({
    apiBaseUrl: deps.config.get('iconCollection.apiBaseUrl', 'https://icons.kage1020.com'),
    defaultLimit: deps.config.get('iconCollection.defaultLimit', 60),
  }),
});
```

- [ ] **Step 4: extension.ts 実装**

```typescript
// apps/vscode-extension/src/extension.ts
import * as vscode from 'vscode';
import { createExtensionHost } from './host-adapter';

const VIEW_TYPE = 'iconCollection.IconCollection';

const buildCsp = (nonce: string, apiBaseUrl: string): string =>
  [
    "default-src 'none'",
    `script-src 'nonce-${nonce}'`,
    "style-src 'unsafe-inline'",
    `connect-src ${apiBaseUrl}`,
    `img-src data: ${apiBaseUrl}`,
    "font-src data:",
  ].join('; ');

const makeNonce = (): string => {
  const arr = new Uint8Array(16);
  globalThis.crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
};

const buildHtml = (nonce: string, csp: string, mainJs: vscode.Uri, mainCss: vscode.Uri): string => `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="stylesheet" href="${mainCss}" />
    <title>Icon Collection</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" nonce="${nonce}" src="${mainJs}"></script>
  </body>
</html>`.trim();

class IconCollectionProvider implements vscode.WebviewViewProvider {
  constructor(private readonly context: vscode.ExtensionContext) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    const host = createExtensionHost({
      globalState: {
        get: (k) => this.context.globalState.get<string>(k) ?? null,
        update: (k, v) => this.context.globalState.update(k, v),
      },
      clipboard: { writeText: (s) => vscode.env.clipboard.writeText(s) },
      ui: {
        showInformationMessage: (m) => {
          void vscode.window.showInformationMessage(m);
        },
        showErrorMessage: (m) => {
          void vscode.window.showErrorMessage(m);
        },
      },
      config: {
        get: <T>(section: string, defaultValue: T): T => {
          const [ns, key] = section.split('.');
          const cfg = vscode.workspace.getConfiguration(ns);
          return cfg.get<T>(key ?? '', defaultValue);
        },
      },
    });

    const distRoot = vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview');
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [distRoot],
    };

    const mainJs = webviewView.webview.asWebviewUri(vscode.Uri.joinPath(distRoot, 'main.js'));
    const mainCss = webviewView.webview.asWebviewUri(vscode.Uri.joinPath(distRoot, 'main.css'));
    const init = host.getInitPayload();
    const nonce = makeNonce();
    const csp = buildCsp(nonce, init.apiBaseUrl);
    webviewView.webview.html = buildHtml(nonce, csp, mainJs, mainCss);

    webviewView.webview.onDidReceiveMessage((msg: unknown) => {
      if (typeof msg !== 'object' || msg === null) return;
      const m = msg as { type?: unknown };
      if (m.type === 'ready') {
        void webviewView.webview.postMessage({ type: 'init', ...init });
        return;
      }
      if (m.type === 'copyText' && typeof (msg as { text?: unknown }).text === 'string') {
        void host.handleCopyText((msg as { text: string }).text);
        return;
      }
      if (m.type === 'showToast' && typeof (msg as { message?: unknown }).message === 'string') {
        const severity = (msg as { severity?: 'info' | 'error' }).severity;
        host.handleShowToast((msg as { message: string }).message, severity);
        return;
      }
      if (m.type === 'persistGet') {
        const req = msg as { requestId?: unknown; key?: unknown };
        if (typeof req.requestId === 'string' && typeof req.key === 'string') {
          void webviewView.webview.postMessage(host.handlePersistGet(req.requestId, req.key));
        }
        return;
      }
      if (m.type === 'persistSet') {
        const req = msg as { key?: unknown; value?: unknown };
        if (typeof req.key === 'string' && typeof req.value === 'string') {
          host.handlePersistSet(req.key, req.value);
        }
        return;
      }
    });
  }
}

export const activate = (context: vscode.ExtensionContext): void => {
  const provider = new IconCollectionProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(VIEW_TYPE, provider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
  );
};

export const deactivate = (): void => undefined;
```

- [ ] **Step 5: テスト green を確認**

Run: `pnpm -F icon-collection test`
Expected: 9/9 passing (5 vscode-host + 4 host-adapter)。

- [ ] **Step 6: build 通過確認**

Run: `pnpm -F icon-collection build`
Expected: `dist/extension.cjs` と `dist/webview/main.js` + `dist/webview/main.css` 生成、exit 0。

- [ ] **Step 7: typecheck / lint**

Run: `pnpm -F icon-collection typecheck && pnpm lint`
Expected: clean。

- [ ] **Step 8: commit**

```bash
git add apps/vscode-extension/src apps/vscode-extension/tests
git commit -m "feat(vscode-extension): implement extension host adapter and activation"
```

---

### Task 6: `.vscode-test.mjs` + integration test

**Files:**
- Create: `apps/vscode-extension/.vscode-test.mjs`
- Create: `apps/vscode-extension/tests/integration/activation.test.ts`

**Interfaces:**
- Uses `@vscode/test-cli` + `@vscode/test-electron` (Task 1 でインストール済み)。CI では headless で実行、ローカルは `pnpm test:integration`。

- [ ] **Step 1: .vscode-test.mjs**

```javascript
import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
  files: 'dist/integration/**/*.test.js',
  workspaceFolder: '.',
  version: 'stable',
  mocha: { timeout: 20000 },
});
```

- [ ] **Step 2: integration テスト**

```typescript
// apps/vscode-extension/tests/integration/activation.test.ts
import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';

suite('IconCollection activation', () => {
  test('registers WebviewViewProvider for iconCollection.IconCollection', async () => {
    const ext = vscode.extensions.getExtension('kage1020.icon-collection');
    assert.ok(ext, 'extension present');
    await ext!.activate();
    // 実 webview の DOM 検証は electron ヘッドレスでは限定的。
    // ここでは activation 成功と subscribe 数のみ確認する。
    assert.ok(ext!.isActive, 'extension active');
  });
});
```

- [ ] **Step 3: tsup で integration test も dist にコピーする設定を追加**

integration test は Mocha が `dist/integration/**/*.test.js` を読むため、tsup config に第 3 エントリを足す:

```typescript
// apps/vscode-extension/tsup.config.ts に追加エントリ
{
  entry: { 'integration/activation.test': 'tests/integration/activation.test.ts' },
  format: ['cjs'],
  platform: 'node',
  target: 'node22',
  external: ['vscode', 'mocha', 'assert'],
  outDir: 'dist',
  sourcemap: true,
},
```

- [ ] **Step 4: local で integration 実行 (CI は Task 8 で組み込む)**

Run: `pnpm -F icon-collection build && pnpm -F icon-collection test:integration`
Expected: PASS 1 (activation)、Electron 起動あり。CI では xvfb / headless 必要 (Task 8 で対応)。

Local で Electron が落ちる場合 (Windows で GPU 不可等) は `--disable-gpu` 追加。plan には汎用手順のみ記載、環境固有は README に。

- [ ] **Step 5: commit**

```bash
git add apps/vscode-extension/.vscode-test.mjs apps/vscode-extension/tests/integration apps/vscode-extension/tsup.config.ts
git commit -m "test(vscode-extension): add activation smoke test"
```

---

### Task 7: README + Azure OIDC セットアップ手順

**Files:**
- Create: `apps/vscode-extension/README.md`
- Create: `apps/vscode-extension/docs/vsce-publish-setup.md`

**Interfaces:** none (docs)

- [ ] **Step 1: README.md**

```markdown
# icon-collection

Icon Collection の VSCode 拡張。Cloudflare Pages でホストされている検索 API と icon delivery を叩く WebView を提供する。

## Runtime

- WebView: Preact + `packages/ui` の SearchPage island を hydrate
- Extension host: `vscode` API bridge (clipboard / toast / persistState)
- 検索 backend: `iconCollection.apiBaseUrl` (default `https://icons.kage1020.com`)

## Settings

| Setting | Default | Description |
|---|---|---|
| `iconCollection.apiBaseUrl` | `https://icons.kage1020.com` | Base URL of the Icon Collection API |
| `iconCollection.defaultLimit` | `60` | Search page size (1..200) |

## Development

```bash
pnpm -F icon-collection dev    # tsup --watch
# In another shell:
# VSCode で apps/vscode-extension を開き、F5 でデバッグ実行
```

## Test

- `pnpm -F icon-collection test` — Vitest unit tests
- `pnpm -F icon-collection test:integration` — @vscode/test-electron activation smoke

## Package

```bash
pnpm -F icon-collection package
```

`icon-collection-0.2.0.vsix` が生成される。

## Publish

`.github/workflows/vsce-publish.yml` が tag push (`v*.*.*`) または `workflow_dispatch` で発火し、Azure OIDC 認証を経て `vsce publish` を実行する。セットアップは `docs/vsce-publish-setup.md` を参照。
```

- [ ] **Step 2: docs/vsce-publish-setup.md**

```markdown
# VSCE Publish (Azure OIDC) セットアップ手順

Marketplace publish 用 PAT の代わりに Azure AD の federated credential を使い、GitHub Actions から短命トークンを取得して `vsce publish` を叩く方法。

## 前提

- Azure AD テナントに管理者権限
- Marketplace publisher `kage1020` の owner 権限
- Repo secrets を編集できる権限

## 手順

1. Azure Portal で App registration を新規作成 (例: `icon-collection-vsce-publish`)
2. **Certificates & secrets → Federated credentials → Add credential**
   - Scenario: `GitHub Actions deploying Azure resources`
   - Organization: `kage1020`
   - Repository: `IconCollection`
   - Entity type: `Tag`
   - Tag pattern: `v*.*.*` (もしくは `refs/tags/v*.*.*`)
   - Name: `github-tag-publish`
3. Azure DevOps organization `kage1020` (Marketplace 発行に使う組織) にこの App registration を Service Principal として追加
4. Marketplace publisher `kage1020` に Service Principal を Contributor で招待
5. GitHub Actions で以下 secrets を登録:
   - `AZURE_CLIENT_ID`: App registration の Application (client) ID
   - `AZURE_TENANT_ID`: Directory (tenant) ID
   - Azure DevOps org 名 (例 `kage1020`) と publisher (`kage1020`) は workflow YAML に直接埋め込む
6. Marketplace 側で publisher に対して `Manage Publisher` 権限を Service Principal に付与 (Marketplace UI から)
7. tag を push (`git tag v0.2.0 && git push origin v0.2.0`) すると workflow が発火

## Rollback / トラブルシュート

- Federated credential の subject が tag pattern と一致しない場合、`AADSTS70021` エラー。credential の Entity type を Tag、Pattern を `v*.*.*` (glob) に設定
- `vsce publish` の 401 は Service Principal の Marketplace 権限不足。publisher UI で権限を再確認
- PAT に fallback したい場合は `.github/workflows/vsce-publish.yml` の環境変数を `VSCE_PAT` にする専用 workflow を退避で用意しておく (このリポジトリでは廃止方針)
```

- [ ] **Step 3: commit**

```bash
git add apps/vscode-extension/README.md apps/vscode-extension/docs
git commit -m "docs(vscode-extension): document runtime, settings, and OIDC publish setup"
```

---

### Task 8: GitHub Actions workflow (vsce-publish.yml + CI 更新)

**Files:**
- Create: `.github/workflows/vsce-publish.yml`
- Modify: `.github/workflows/ci.yml` — `pnpm -F icon-collection test` と `build` を CI に含める

**Interfaces:** none

- [ ] **Step 1: CI に vscode-extension を追加**

`.github/workflows/ci.yml` の末尾に:

```yaml
      - run: pnpm -F icon-collection build
```

`pnpm test` は既に workspace 全体を回すので個別追加不要。

- [ ] **Step 2: vsce-publish.yml**

```yaml
name: vsce-publish

on:
  workflow_dispatch:
  push:
    tags: ['v*.*.*']

permissions:
  id-token: write
  contents: read

jobs:
  publish:
    runs-on: ubuntu-latest
    environment: vsce
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .node-version
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm -F icon-collection typecheck
      - run: pnpm -F icon-collection test
      - run: pnpm -F icon-collection build
      - name: Azure login (OIDC)
        uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          allow-no-subscriptions: true
      - name: Publish to Marketplace
        env:
          VSCE_AZURE_TENANT_ID: ${{ secrets.AZURE_TENANT_ID }}
        run: |
          pnpm -F icon-collection exec vsce publish \
            --azure-credential
      - name: Upload vsix artifact
        uses: actions/upload-artifact@v4
        with:
          name: icon-collection-vsix
          path: apps/vscode-extension/*.vsix
          if-no-files-found: ignore
```

`vsce publish --azure-credential` は `azure/login@v2` が確立した Managed Identity のトークンを利用する。

- [ ] **Step 3: local dry-run (Actions は本番でしか発火しない)**

Run: `pnpm -F icon-collection typecheck && pnpm -F icon-collection test && pnpm -F icon-collection build && pnpm -F icon-collection package`
Expected: `.vsix` 生成、exit 0

- [ ] **Step 4: PR 作成**

```bash
git push -u origin feat/revamp-vscode
gh pr create --title "feat: rewrite VSCode extension with Preact + Plan C API" --body "$(cat <<'EOF'
## Summary
- 旧 `extension/` (Algolia + 手書き HTML) を `apps/vscode-extension/` に置き換え、Preact + `packages/ui` の HostProvider で WebView を実装
- 検索 backend を Algolia から Plan C の `/api/search` に移行、API base URL は `iconCollection.apiBaseUrl` で configurable
- Publish を PAT から Azure OIDC federated credential に移行

## Test plan
- [ ] pnpm -F icon-collection test — unit 9/9 pass
- [ ] pnpm -F icon-collection typecheck — clean
- [ ] pnpm -F icon-collection build — dist/{extension.cjs, webview/main.js, webview/main.css} 生成
- [ ] pnpm -F icon-collection package — .vsix 生成
- [ ] F5 デバッグで WebView 表示 → home で検索 → SVG コピー動作

## Follow-up (別 plan)
- Plan E: 旧 `extension/` 削除、DNS 切替、後方互換 route、旧 asset クリーンアップ
EOF
)"
```

- [ ] **Step 5: commit**

```bash
git add .github/workflows
git commit -m "ci: run vscode-extension checks and add vsce-publish workflow"
```

---

## Post-Plan Follow-ups (別 plan)

- Plan E: 旧 `extension/` 削除、`icons.kage1020.com` DNS 切替、後方互換 route (旧 endpoint `/{c}/{n}.svg` を新 `/icon/{c}/{n}.svg` にリダイレクト)、旧 asset クリーンアップ
- 未使用 devDep (`happy-dom` in apps/web) や `cloudflare:test` → `cloudflare:workers` migration 等 Plan C の Minor
