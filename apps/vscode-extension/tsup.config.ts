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
      // Emit dist/webview/main.css without a content hash so extension.ts can
      // reference a stable filename when building the WebView HTML shell.
      options.assetNames = '[name]';
    },
    loader: { '.css': 'copy' },
  },
  {
    entry: { 'integration/activation.test': 'tests/integration/activation.test.ts' },
    format: ['cjs'],
    platform: 'node',
    target: 'node22',
    external: ['vscode', 'mocha', 'assert'],
    outDir: 'dist',
    sourcemap: true,
  },
]);
