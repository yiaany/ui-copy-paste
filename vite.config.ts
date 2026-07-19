import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config.ts';

// Сборка расширения: CRXJS даёт HMR для MV3, Tailwind v4 — через vite-плагин (без tailwind.config).
export default defineConfig({
  plugins: [react(), tailwindcss(), crx({ manifest })],
  server: {
    // Стабильный порт + строгий HMR-порт: нужно для корректного HMR контент-скриптов в CRXJS.
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173,
    },
  },
  build: {
    target: 'esnext',
  },
});
