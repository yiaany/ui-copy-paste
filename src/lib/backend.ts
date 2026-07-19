/**
 * Клиент бэкенд-прокси. Расширение → бэкенд → LLM.
 *
 * Только BYOK: пользователь подключает свой ключ (OpenAI/Claude/
 * OpenAI-совместимый) — он берётся из настроек и уходит на бэкенд как passthrough.
 * URL/ретраи/таймауты — здесь; понятные коды ошибок (401/422/5xx).
 */
import type { ExtractedNode, GenerateResponse, Viewport } from './types.ts';
import { getSettings, buildByokPayload, type GenerateTuning } from './settings.ts';

/** Таймаут одного запроса генерации (модель может думать). */
const GENERATE_TIMEOUT_MS = 60_000;
const HEALTH_TIMEOUT_MS = 4_000;
/** Сколько раз ретраить сеть/5xx (плюс первая попытка). */
const MAX_RETRIES = 2;

/** Чистый путь: генерация по DOM-дереву. */
export interface DomGenerateOptions {
  mode: 'dom';
  node: ExtractedNode;
  viewport: Viewport;
  fullPage: boolean;
}

/** Грязный путь: генерация по crop-скриншоту. */
export interface ScreenshotGenerateOptions {
  mode: 'screenshot';
  screenshotBase64: string;
  viewport: Viewport;
  fullPage: boolean;
}

export type GenerateOptions = DomGenerateOptions | ScreenshotGenerateOptions;

export type GenerateOutcome =
  | { ok: true; result: GenerateResponse }
  | { ok: false; error: string; blocked?: boolean };

/** Заголовки запроса. */
async function buildHeaders(): Promise<Record<string, string>> {
  const settings = await getSettings();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (settings.authToken) headers.Authorization = `Bearer ${settings.authToken}`;
  return headers;
}

/** fetch с таймаутом через AbortController. */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

/** Проверяет доступность бэкенда. */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const { backendUrl } = await getSettings();
    const res = await fetchWithTimeout(
      `${backendUrl}/health`,
      { method: 'GET' },
      HEALTH_TIMEOUT_MS,
    );
    return res.ok;
  } catch {
    return false;
  }
}

/** Тело запроса по режиму + BYOK-конфиг и тюнинг из настроек. */
async function buildBody(opts: GenerateOptions): Promise<Record<string, unknown>> {
  const base: Record<string, unknown> =
    opts.mode === 'dom'
      ? { mode: 'dom', fullPage: opts.fullPage, dom: opts.node, viewport: opts.viewport }
      : {
          mode: 'screenshot',
          fullPage: opts.fullPage,
          screenshotBase64: opts.screenshotBase64,
          viewport: opts.viewport,
        };

  const settings = await getSettings();
  const byok = buildByokPayload(settings);
  if (byok) base.byok = byok;

  const tuning: GenerateTuning = {
    animations: settings.animations,
    typescript: settings.typescript,
    accessibility: settings.accessibility,
    styleHint: settings.styleHint,
  };
  base.tuning = tuning;
  return base;
}

/** Человекочитаемое сообщение по HTTP-коду. */
function messageForStatus(status: number, serverMsg?: string): string {
  switch (status) {
    case 401:
      return serverMsg ?? 'Бэкенд отклонил ключ (401). Проверь ключ модели в настройках.';
    case 422:
      return serverMsg ?? 'Запрос отклонён фильтром безопасности (422).';
    case 429:
      return serverMsg ?? 'Слишком много запросов (429). Подожди и повтори.';
    case 500:
    case 502:
    case 503:
    case 504:
      return serverMsg ?? `Ошибка сервера (${status}). Повтори позже.`;
    default:
      return serverMsg ?? `Бэкенд вернул ${status}.`;
  }
}

/** Запрашивает генерацию (dom/screenshot) с ретраями и таймаутом. */
export async function generateComponent(
  opts: GenerateOptions,
): Promise<GenerateOutcome> {
  const { backendUrl } = await getSettings();
  const headers = await buildHeaders();
  const body = JSON.stringify(await buildBody(opts));

  let lastError = 'Бэкенд недоступен';
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const res = await fetchWithTimeout(
        `${backendUrl}/generate`,
        { method: 'POST', headers, body },
        GENERATE_TIMEOUT_MS,
      );

            if (res.ok) {
        const result = (await res.json()) as GenerateResponse;
        return { ok: true, result };
      }

      const errBody = (await res.json().catch(() => null)) as {
        error?: string;
        blocked?: boolean;
      } | null;

      // 422 (фильтр), 401 (ключ) и 429 (лимит) — окончательные ответы, не ретраим.
      if (res.status === 422) {
        return {
          ok: false,
          error: messageForStatus(422, errBody?.error),
          blocked: errBody?.blocked,
        };
      }
      if (res.status === 401) {
        return { ok: false, error: messageForStatus(401, errBody?.error) };
      }
      if (res.status === 429) {
        return { ok: false, error: messageForStatus(429, errBody?.error) };
      }

      lastError = messageForStatus(res.status, errBody?.error);
      // 5xx — ретраим с backoff (если попытки остались).
      if (res.status >= 500 && attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
        continue;
      }
      return { ok: false, error: lastError };
    } catch (err) {
      lastError =
        err instanceof Error && err.name === 'AbortError'
          ? 'Превышено время ожидания бэкенда. Повтори или проверь, запущен ли он.'
          : 'Не удалось связаться с бэкендом. Проверь, что он запущен (start-backend.bat).';
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
        continue;
      }
    }
  }
  return { ok: false, error: lastError };
}

/**
 * Стриминг-генерация (Сессия 10): читает SSE с /generate/stream.
 * onDelta вызывается на каждый кусок сырого кода; финал — событие done с
 * очищенным результатом. Без ретраев (стрим уже начался) — при сбое возвращает ошибку.
 */
export async function generateComponentStream(
  opts: GenerateOptions,
  onDelta: (chunk: string) => void,
): Promise<GenerateOutcome> {
  const { backendUrl } = await getSettings();
  const headers = await buildHeaders();

  let res: Response;
  try {
    res = await fetch(`${backendUrl}/generate/stream`, {
      method: 'POST',
      headers,
      body: JSON.stringify(await buildBody(opts)),
    });
  } catch {
    return {
      ok: false,
      error: 'Не удалось связаться с бэкендом. Проверь, что он запущен (start-backend.bat).',
    };
  }

  if (!res.ok || !res.body) {
    const errBody = (await res.json().catch(() => null)) as {
      error?: string;
      blocked?: boolean;
    } | null;
    if (res.status === 422) {
      return { ok: false, error: messageForStatus(422, errBody?.error), blocked: errBody?.blocked };
    }
    return { ok: false, error: messageForStatus(res.status, errBody?.error) };
  }

  // Парсим SSE-поток: блоки разделены \n\n, строки event:/data:.
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalResult: GenerateOutcome | null = null;

  const handleEvent = (event: string, data: string): void => {
    if (event === 'delta') {
      onDelta(data);
    } else if (event === 'done') {
      try {
        const result = JSON.parse(data) as GenerateResponse;
        finalResult = { ok: true, result };
      } catch {
        finalResult = { ok: false, error: 'Не удалось разобрать ответ бэкенда.' };
      }
    } else if (event === 'error') {
      const parsed = JSON.parse(data) as { error?: string };
      finalResult = { ok: false, error: parsed.error ?? 'Ошибка генерации.' };
    }
  };

  // SSE: data может быть многострочным; собираем до пустой строки.
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split('\n\n');
    buffer = blocks.pop() ?? '';
    for (const block of blocks) {
      let event = 'message';
      const dataLines: string[] = [];
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''));
      }
      if (dataLines.length > 0) handleEvent(event, dataLines.join('\n'));
    }
  }

  return finalResult ?? { ok: false, error: 'Поток прервался без результата.' };
}
