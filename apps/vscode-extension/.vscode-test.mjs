import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
  files: 'dist/integration/**/*.test.cjs',
  workspaceFolder: '.',
  version: 'stable',
  mocha: { timeout: 20000 },
});
