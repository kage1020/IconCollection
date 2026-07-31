import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.toml' },
      miniflare: {
        compatibilityDate: '2026-01-01',
        d1Databases: ['DB'],
        r2Buckets: ['ICONS'],
      },
    }),
  ],
  test: {
    name: 'workers',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    exclude: [...configDefaults.exclude, 'tests/browser/**'],
  },
});
