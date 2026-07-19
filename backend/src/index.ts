/**
 * Тонкий бэкенд-прокси UI Copy-Paste.
 *
 * Hono на Node. POST /generate: расширение шлёт GenerateRequest → бэкенд выбирает
 * провайдера по BYOK → возвращает { code, componentName, warnings }.
 *
 * Только BYOK: пользователь принёс свой ключ в теле запроса (byok). Ключ
 * НЕ логируется и НЕ сохраняется — используется только на время запроса.
 *
 * Авторизация — опциональный статический Bearer-токен из env (доступ к инстансу).
 */
import 'dotenv/config';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { streamSSE } from 'hono/streaming';
import { serve } from '@hono/node-server';
import { GenerateRequestSchema, type Byok, type GenerateTuning } from './schema.ts';
import {
  buildSystemPrompt,
  buildUserContent,
  buildRepairPrompt,
} from './prompt.ts';
import { createByokProvider } from './llm/factory.ts';
import type { LlmProvider } from './llm/provider.ts';
import {
  extractCodeBlock,
  extractComponentName,
  collectWarnings,
} from './extract-code.ts';
import { fixImports } from './fix-imports.ts';
import { validateTsx } from './validate.ts';
import { detectSensitivePage } from './safety.ts';

const PORT = Number(process.env.PORT ?? 8799);
const MAX_TOKENS = 16000;
const AUTH_TOKEN = process.env.BACKEND_AUTH_TOKEN;

const app = new Hono();

// CORS: расширение шлёт с chrome-extension://-origin.
app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Client-Id'],
  }),
);

app.get('/health', (c) =>
  c.json({
    ok: true,
    service: 'ui-copy-paste-backend',
    byok: true,
  }),
);

/** Результат пост-обработки: чистый код + componentName + warnings. */
interface Processed {
  code: string;
  componentName: string;
  warnings: string[];
}

/**
 * Пост-обработка сырого ответа LLM: вырезать tsx → дописать импорты → валидация
 * esbuild → при ошибке один repair-проход. Общая для /generate и /generate/stream.
 */
async function postProcess(
  rawCode: string,
  system: string,
  provider: LlmProvider,
): Promise<Processed> {
  let code = extractCodeBlock(rawCode);
  const warnings = collectWarnings(code);

  const fixed = fixImports(code);
  code = fixed.code;
  if (fixed.added.length > 0) {
    warnings.push(`Дописаны импорты: ${fixed.added.join('; ')}`);
  }

  const validation = await validateTsx(code);
  if (!validation.ok && validation.error) {
    console.warn('[generate] код не компилируется, чиним:', validation.error);
    const repairRaw = await provider.generate({
      system,
      content: [{ type: 'text', text: buildRepairPrompt(code, validation.error) }],
      maxTokens: MAX_TOKENS,
    });
    const repaired = fixImports(extractCodeBlock(repairRaw)).code;
    const reval = await validateTsx(repaired);
    if (reval.ok) {
      code = repaired;
      warnings.push('Код не компилировался — исправлен автоматически (1 итерация).');
    } else {
      warnings.push(
        `Код может не компилироваться: ${reval.error ?? validation.error}. Проверь вручную.`,
      );
    }
  }

  return { code, componentName: extractComponentName(code), warnings };
}

/** Проверка Bearer-токена (заглушка авторизации). null = всё ок. */
function checkAuth(authHeader: string | undefined): string | null {
  if (AUTH_TOKEN && authHeader !== `Bearer ${AUTH_TOKEN}`) return 'Unauthorized';
  return null;
}

/**
 * Выбирает провайдера по BYOK. Без byok — 401 (нужен свой ключ).
 */
type ProviderResolution =
  | { ok: true; provider: LlmProvider }
  | { ok: false; status: 401 | 400; error: string };

function resolveProvider(byok: Byok | undefined): ProviderResolution {
  if (!byok) {
    return {
      ok: false,
      status: 401,
      error:
        'Нужен свой API-ключ. Открой Settings → Model и подключи OpenAI / Claude / OpenAI-compatible.',
    };
  }
  try {
    return { ok: true, provider: createByokProvider(byok) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Некорректный BYOK-конфиг';
    return { ok: false, status: 401, error: msg };
  }
}

app.post('/generate', async (c) => {
  if (checkAuth(c.req.header('Authorization'))) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Некорректный JSON' }, 400);
  }

  const parsed = GenerateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: 'Невалидный GenerateRequest', issues: parsed.error.issues },
      400,
    );
  }

  // Правовой/этический фильтр: отказ для платёжных/банк-логинов.
  const verdict = detectSensitivePage(parsed.data.dom);
  if (verdict.blocked) {
    return c.json({ error: verdict.reason, blocked: true }, 422);
  }

  const resolution = resolveProvider(parsed.data.byok);
  if (!resolution.ok) {
    return c.json({ error: resolution.error }, resolution.status);
  }

  try {
    const tuning: GenerateTuning | undefined = parsed.data.tuning;
    const system = buildSystemPrompt(tuning);
    const content = buildUserContent(parsed.data);
    const raw = await resolution.provider.generate({ system, content, maxTokens: MAX_TOKENS });
    const result = await postProcess(raw, system, resolution.provider);
    return c.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка генерации';
    console.error('[generate] ошибка:', message);
    return c.json({ error: message }, 502);
  }
});

/**
 * Стриминг: SSE. Шлём delta-события по мере генерации, затем пост-обрабатываем
 * и шлём финальное событие `done` с очищенным кодом. Ошибки → событие `error`.
 */
app.post('/generate/stream', async (c) => {
  if (checkAuth(c.req.header('Authorization'))) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Некорректный JSON' }, 400);
  }
  const parsed = GenerateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Невалидный GenerateRequest' }, 400);
  }
  const verdict = detectSensitivePage(parsed.data.dom);
  if (verdict.blocked) {
    return c.json({ error: verdict.reason, blocked: true }, 422);
  }

  const resolution = resolveProvider(parsed.data.byok);
  if (!resolution.ok) {
    return c.json({ error: resolution.error }, resolution.status);
  }
  const provider = resolution.provider;

  const system = buildSystemPrompt(parsed.data.tuning);
  const content = buildUserContent(parsed.data);

  return streamSSE(c, async (stream) => {
    try {
      let raw: string;
      if (provider.generateStream) {
        raw = await provider.generateStream({ system, content, maxTokens: MAX_TOKENS }, (delta) => {
          void stream.writeSSE({ event: 'delta', data: delta });
        });
      } else {
        raw = await provider.generate({ system, content, maxTokens: MAX_TOKENS });
        await stream.writeSSE({ event: 'delta', data: raw });
      }

      const result = await postProcess(raw, system, provider);
      await stream.writeSSE({ event: 'done', data: JSON.stringify(result) });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка генерации';
      console.error('[generate/stream] ошибка:', message);
      await stream.writeSSE({ event: 'error', data: JSON.stringify({ error: message }) });
    }
  });
});

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`\n  UI Copy-Paste backend на http://localhost:${info.port}`);
  console.log('  Режим: BYOK only (свой ключ пользователя)');
  console.log(
    `  Авторизация: ${AUTH_TOKEN ? 'Bearer (env)' : 'выключена (нет BACKEND_AUTH_TOKEN)'}\n`,
  );
});
