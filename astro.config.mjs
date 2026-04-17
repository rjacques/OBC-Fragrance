// @ts-check
import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        'astro/entrypoints/prerender': fileURLToPath(new URL('./node_modules/astro/dist/entrypoints/prerender.js', import.meta.url)),
        'astro/entrypoints/legacy': fileURLToPath(new URL('./node_modules/astro/dist/entrypoints/legacy.js', import.meta.url))
      }
    }
  }
});
