import { defineConfig } from 'vitest/config';

// Юниты только для чистой логики (css-to-tailwind, extractor, heuristics,
// безопасность CLI) — без браузера и без chrome.*; окружение node достаточно.
export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'src/**/*.{test,spec}.ts',
      'cli/src/**/*.{test,spec}.ts',
      'backend/src/**/*.{test,spec}.ts',
    ],
    globals: true,
  },
});

