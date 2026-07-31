# Plan D: VSCode 拡張リニューアル 設計仕様

**Status:** Draft
**Date:** 2026-07-31
**Depends on:** Plan A (`packages/{core,synonyms,ui}`), Plan C (`/api/search`, `/icon/*.svg`, `/icon/*.mx` on Cloudflare Pages)

## 目的

既存 `extension/` (v0.1.2) を `apps/vscode-extension/` に移設し、`packages/ui` の Preact コンポーネント + `Host` interface を WebView で hydrate、Algolia + ハードコード API key を破棄、Plan C の `/api/search` に置き換える。ビルドを tsup で二段構成、公開は Azure OIDC 経由の GitHub Actions で PAT レス化。

## 非目的

- 検索アルゴリズム変更 (Plan C の synonym expansion をそのまま利用)
- 新機能追加 (例: keyboard shortcut / palette 統合など)。既存の "search + copy SVG / copy Diagram" を新スタックで再現するだけ
- モバイル / web VSCode サポート (Node ランタイム前提)
- DNS 切替 (Plan E 担当)

## アーキテクチャ

```
apps/vscode-extension/
├── package.json              (publisher, contributes, activationEvents, scripts)
├── tsup.config.ts            (2 entry: extension.ts + webview/main.tsx)
├── src/
│   ├── extension.ts          (Node target, activation, WebViewProvider, message bridge)
│   ├── host-adapter.ts       (Extension host 側の Host 実装: clipboard/toast/persistState)
│   └── webview/
│       ├── main.tsx          (Browser target, Preact render, HostProvider wrap)
│       ├── vscode-host.ts    (WebView 側の Host 実装: fetch/clipboard→postMessage/localStorage-ish)
│       └── index.html.ts     (bootstrap HTML template with CSP header + script tag)
├── tests/
│   ├── webview-host.test.ts  (vscode-host の unit test)
│   └── extension.test.ts     (activation の unit test with vscode-test-electron)
└── dist/                     (tsup 出力、.vscodeignore で公開対象外を除外)
```

**Runtime split:**
- **Extension host** (Node runtime): `src/extension.ts` — `vscode` API に直接触れる。`activationEvents`, `WebviewViewProvider`, message handler。
- **WebView** (browser-ish runtime with CSP): `src/webview/main.tsx` — Preact hydration。`packages/ui/HostProvider` + `SearchPage` island を移植 (`apps/web` の SearchPage を base に、Host の実装だけ差し替え)。

**Data flow:**
```
User types → WebView SearchBox → useSearch → Host.apiClient.search
                                              ↓ fetch (WebView 直接)
                                     https://icons.kage1020.com/api/search
                                              ↓ SearchResponse JSON
User clicks copy → Host.copyText(svg)
                     ↓ postMessage { type: 'copy', text }
                   Extension host
                     ↓ vscode.env.clipboard.writeText
                     ↓ vscode.window.showInformationMessage
```

## Global Constraints

- Node 22 LTS / pnpm 9 / TypeScript strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `allowImportingTsExtensions`)
- Bundler: **tsup** (extension + webview の 2 entry を 1 config で管理)
- Test: **Vitest 4** (unit) + `@vscode/test-electron` (extension activation の integration test)
- Lint/Format: Biome 2
- 依存バージョンは `pnpm add` 経由、ハードコード禁止
- **linter-ignore ディレクティブ禁止** (`@ts-ignore` / `@biome-ignore` など)。旧 `extension.ts` の `let url, svg;` + `switch` に含まれる any 系は完全書き直しで解消
- 公開情報 (Algolia app ID / API key など) の削除
- VSCode WebView CSP を明示: `default-src 'none'; script-src 'nonce-{RANDOM}'; style-src 'unsafe-inline'; connect-src https://icons.kage1020.com; img-src data: https://icons.kage1020.com; font-src data:;`
- 拡張の `version` は `0.2.0`。CHANGELOG.md に breaking な内部再構築を明記
- 拡張 setting: `iconCollection.apiBaseUrl` (default `https://icons.kage1020.com`)、`iconCollection.defaultLimit` (default 60、max 200)

## API 設計

### Extension host (`src/extension.ts`)

- `activationEvents`: `onView:iconCollection.IconCollection` のまま (既存互換)
- `WebviewViewProvider.resolveWebviewView` で:
  - `webview.options = { enableScripts: true, localResourceRoots: [context.extensionUri, ...] }`
  - `webview.html = renderHtml(cspNonce, mainJsUri, mainCssUri)` — `dist/webview/main.js` を asWebviewUri で読み込む
  - `webview.onDidReceiveMessage` で `HostAdapter` にディスパッチ
- `HostAdapter` は以下を提供 (Host interface の extension 側実装):
  - `copyText(s)` → `vscode.env.clipboard.writeText(s)` + `showInformationMessage('Copied')`
  - `showToast(m)` → `vscode.window.showInformationMessage(m)` (エラー系は `showErrorMessage`)
  - `persistState.get/set` → `context.globalState`
  - `apiBaseUrl` はここでは持たず、settings から WebView へ initial state として渡す

### WebView (`src/webview/main.tsx`)

- `packages/ui` の `HostProvider` を使う
- Host 実装 (`vscode-host.ts`):
  - `apiBaseUrl`: settings から initial data 経由で受領
  - `apiClient`: `createApiClient({ baseUrl })` を WebView 内で構築 (WebView 直接 fetch)
  - `svgCache`: `createSvgCache()` を WebView 内で 1 度生成 (WebView reload で自然にクリア)
  - `copyText`: `postMessage({ type: 'copyText', text })` を extension host に投げる (WebView の `navigator.clipboard` は制限あるため)
  - `showToast`: `postMessage({ type: 'showToast', message })`
  - `persistState`: `postMessage` で globalState アクセス (get は往復するので debounce 前提の usage で fine)
- SearchPage island は `apps/web` から流用可能。差分は Host 実装のみ。

### Message protocol (extension ↔ webview)

```typescript
// WebView → Extension
type OutboundMessage =
  | { type: 'ready' }
  | { type: 'copyText'; text: string }
  | { type: 'showToast'; message: string; severity?: 'info' | 'error' }
  | { type: 'persistGet'; requestId: string; key: string }
  | { type: 'persistSet'; key: string; value: string };

// Extension → WebView
type InboundMessage =
  | { type: 'init'; apiBaseUrl: string; defaultLimit: number }
  | { type: 'persistGetResult'; requestId: string; value: string | null };
```

`ready` 受信後に `init` を返す (初期化の順序保証)。

## セキュリティ

- Algolia app ID / API key は完全削除 (`extension/` 全体を新規 `apps/vscode-extension/` に置換、旧 `extension/` は Plan E で削除)
- WebView CSP は上記 constraints セクションのものを nonce 付きで発行
- `webview.html` 内の `<script>` タグは nonce required (CSP 準拠)
- `connect-src` は settings から取得した baseUrl のみ許可 (default は kage1020.com 固定、任意の URL 許可はしない — `iconCollection.apiBaseUrl` の値が nonce 生成時に埋め込まれる)

## Publish

- `.github/workflows/vsce-publish.yml`:
  - trigger: manual (`workflow_dispatch`) + tag push (`v*.*.*`)
  - Azure OIDC 認証: `azure/login@v2` with `enable-AzPSSession` を経て、Marketplace 発行トークンを短命 exchange
  - `vsce publish` を `@vscode/vsce` の CLI で実行
  - `.vsix` を Actions artifacts に保存
- `personalAccessToken` を使う旧フローは廃止 (secrets から削除)
- Azure AD app registration + federated credential (repo:kage1020/IconCollection:ref:refs/tags/v*) は plan doc に手動セットアップ手順として記載 (Actions では実行しない)

## テスト戦略

- **Unit (Vitest 4)**:
  - `vscode-host.ts` の各メソッドが正しい `postMessage` を投げる (jsdom + `acquireVsCodeApi` mock)
  - `HostAdapter` の各 handler が `vscode` API を叩く (`vitest-mock-extended` or manual mock)
- **Integration (@vscode/test-electron)**:
  - 拡張 activation → WebView 表示 → search クエリ発火 → mock API 応答 → hit render の smoke
  - CI では headless Electron を回すためやや遅い。CI matrix で分離。
- **Type-check**: extension host + webview の 2 tsconfig (target/lib が異なる)

## 移行手順

1. `extension/` の内容は Plan E で削除、Plan D では `apps/vscode-extension/` を新規作成 (旧 `extension/` の CHANGELOG.md と images/ だけコピー)
2. `pnpm-workspace.yaml` は `apps/*` を既に含むため無変更
3. Old Algolia app ID / API key はコード上から完全削除。Marketplace 説明や CHANGELOG に revocation を明記する必要はない (公開ドキュメントで宣伝している credential ではなく、単なる旧実装 detail のため)。key 自体は git 履歴に残るので owner が Algolia dashboard で無効化するかは Plan D の範囲外。**secrets のログ出力・記録は禁止**。

## Deliverables

- `apps/vscode-extension/` 一式 (package.json, tsup.config.ts, src/**, tests/**, CHANGELOG.md, .vscodeignore)
- `.github/workflows/vsce-publish.yml`
- Azure OIDC セットアップ手順を README または `docs/vsce-publish.md` に記載
- 旧 `extension/` は Plan E で削除 (この plan では touch しない)

## Open Questions

なし。
