import cloudflare from '@astrojs/cloudflare';
import preact from '@astrojs/preact';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  adapter: cloudflare({ mode: 'directory' }),
  integrations: [preact()],
  vite: { plugins: [tailwindcss()] },
});
