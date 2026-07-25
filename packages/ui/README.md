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
