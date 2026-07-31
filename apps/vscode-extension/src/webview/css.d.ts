// tsup/esbuild copies `.css` imports as build-time assets (see tsup.config.ts
// `loader: { '.css': 'copy' }`); there is no runtime module shape to type, so
// side-effect imports of `.css` files just need to type-check as valid modules.
declare module '*.css';
