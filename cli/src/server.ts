/**
 * Локальный мост в редактор (Сессия 5).
 *
 * HTTP-сервер на localhost:31337. По запросу расширения пишет сгенерированный
 * .tsx в <cwd>/src/components. Все редакторы (Cursor/VS Code/Claude Code/Codex/
 * OpenCode) файловые, поэтому запись на диск универсальна.
 *
 * Только Node stdlib — никаких зависимостей, чтобы `npx ui-copy-paste` был лёгким.
 * Безопасность пути — см. safe-path.ts (санитизация + traversal-защита, доктрина 5).
 */
import http from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolveSafePath } from './safe-path.ts';

const PORT = 31337;
const HOST = '127.0.0.1';
/** Лимит тела запроса — генерируемый компонент не бывает огромным. */
const MAX_BODY = 2 * 1024 * 1024; // 2 МБ

/** Единые CORS-заголовки: расширение шлёт с chrome-extension://-origin. */
function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function sendJson(
  res: http.ServerResponse,
  status: number,
  body: unknown,
): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    ...corsHeaders(),
  });
  res.end(payload);
}

/** Читает тело запроса с ограничением размера. */
function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error('Тело запроса слишком большое'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

interface WritePayload {
  componentName?: unknown;
  code?: unknown;
}

async function handleWrite(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  let parsed: WritePayload;
  try {
    parsed = JSON.parse(await readBody(req)) as WritePayload;
  } catch {
    sendJson(res, 400, { ok: false, error: 'Некорректный JSON' });
    return;
  }

  if (typeof parsed.code !== 'string' || parsed.code.length === 0) {
    sendJson(res, 400, { ok: false, error: 'Поле code обязательно' });
    return;
  }

  let safe;
  try {
    safe = resolveSafePath(process.cwd(), String(parsed.componentName ?? ''));
  } catch {
    // Traversal-попытка — отвергаем (доктрина 5).
    sendJson(res, 400, { ok: false, error: 'Недопустимое имя/путь' });
    return;
  }

  try {
    await mkdir(safe.dir, { recursive: true });
    await writeFile(safe.filePath, parsed.code, 'utf8');
    console.log(`✓ записан ${safe.filePath}`);
    sendJson(res, 200, {
      ok: true,
      path: safe.filePath,
      componentName: safe.name,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка записи';
    console.error(`✗ не удалось записать: ${message}`);
    sendJson(res, 500, { ok: false, error: message });
  }
}

const server = http.createServer((req, res) => {
  // Preflight.
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders());
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    sendJson(res, 200, { ok: true, service: 'ui-copy-paste', port: PORT });
    return;
  }

  if (req.method === 'POST' && req.url === '/write') {
    void handleWrite(req, res);
    return;
  }

  sendJson(res, 404, { ok: false, error: 'Not found' });
});

server.listen(PORT, HOST, () => {
  console.log(`\n  UI Copy-Paste — мост запущен`);
  console.log(`  http://${HOST}:${PORT}`);
  console.log(`  Файлы пишутся в: ${process.cwd()}/src/components`);
  console.log(`  Оставь это окно открытым. Ctrl+C — остановить.\n`);
});
