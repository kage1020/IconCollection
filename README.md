# Icon Collection

A curated icon library with a fast, globally-distributed search API and a VS Code extension.

## Hosted API

The Icon Collection API is hosted at `https://icons.kage1020.com` and provides three endpoints:

### Search icons

```bash
curl "https://icons.kage1020.com/api/search?q=home&limit=10"
```

Returns paginated results with metadata (collection, license, dimensions).

### Get SVG icon

```bash
curl "https://icons.kage1020.com/icon/mdi/home.svg"
```

Immutably cached with `max-age=31536000` and immutable directives.

### Get MX library format

```bash
curl "https://icons.kage1020.com/icon/mdi/home.mx"
```

For use with design tools. Legacy URLs (`/{collection}/{name}.svg`) redirect via 301 to `/icon/{collection}/{name}.svg`.

## Monorepo structure

- `apps/web` — Astro SSG + Cloudflare Pages Functions for search UI and icon delivery
- `apps/vscode-extension` — VS Code extension (marketplace: [kage1020.icon-collection](https://marketplace.visualstudio.com/items?itemName=kage1020.icon-collection))
- `packages/core` — Core search and icon library types
- `packages/synonyms` — Synonym expansion for search
- `packages/ui` — Shared Preact UI components
- `tools/ingest` — Iconify ingest pipeline (see [`tools/ingest/README.md`](./tools/ingest/README.md) for Cloudflare R2/D1 setup)

## Development

### Quick start

```bash
pnpm install
pnpm test                          # Run all tests
pnpm typecheck                     # Type check all packages
pnpm lint                          # Lint all code

# Development servers
pnpm -F @icon-collection/web dev   # Web UI (localhost:3000)
pnpm -F icon-collection dev        # VSCode extension (watch mode)
```

### Full build

```bash
pnpm -F @icon-collection/web build  # Build web app to dist/
pnpm -F icon-collection package     # Package VSCode extension (.vsix)
```

## Icon sources

The ingest pipeline (`tools/ingest`) pulls icons from Iconify, including collections like:
Material Design Icons (MDI), Lucide, Heroicons, Tabler, Bootstrap Icons, Font Awesome, Carbon, and many others. See `tools/ingest/README.md` for configuration and collection details.

## License

This project is licensed under the MIT License. See the [LICENCE](./LICENCE) file for details.
