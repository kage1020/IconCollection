import preact from '@preact/preset-vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [preact()],
  test: {
    name: 'browser',
    environment: 'happy-dom',
    include: ['tests/browser/**/*.test.tsx'],
    setupFiles: ['./tests/browser/setup.ts'],
  },
});
