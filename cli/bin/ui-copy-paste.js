#!/usr/bin/env node
/**
 * Запуск моста UI Copy-Paste. Грузит собранный сервер из dist/.
 * Если dist/ нет (запуск из исходников без сборки) — подсказываем `pnpm build`.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const serverPath = join(here, '..', 'dist', 'server.js');

if (!existsSync(serverPath)) {
  console.error(
    'Сборка не найдена (dist/server.js). Из каталога cli/ выполни: pnpm install && pnpm build',
  );
  process.exit(1);
}

// На Windows dynamic import() требует file://-URL, а не абсолютный путь C:\...
await import(pathToFileURL(serverPath).href);

