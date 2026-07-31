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
