/**
 * Service worker (MV3, type: module).
 *
 * Поведение по клику на иконку расширения:
 *   1) открываем сайдбар (chrome.sidePanel) для активной вкладки;
 *   2) программно инжектим content-скрипт (доктрина 4: никаких статических
 *      content_scripts и <all_urls> — доступ только по клику, activeTab);
 *   3) после успешной инъекции шлём START_INSPECT, чтобы запустить инспектор.
 *
 * Сессия 7: обрабатываем CAPTURE_CROP — снимаем видимую область и вырезаем
 * прямоугольник элемента через OffscreenCanvas (в SW нет document/canvas).
 *
 * Фикс: REQUEST_INSPECT — кнопка в сайдбаре идёт через background, который
 * (пере)инжектит content-скрипт и запускает инспекцию. Самовосстанавливающийся
 * путь: на SPA (YouTube и т.п.) content-скрипт теряется после навигации, а прямой
 * tabs.sendMessage из сайдбара тогда отклоняется. Инъекция идемпотентна (флаг
 * __uiCopyPasteInjected__ в content-скрипте защищает от повторной регистрации).
 *
 * Путь к собранному content-бандлу берём у CRXJS через импорт с суффиксом
 * `?script` — он возвращает корректный extension-relative путь и после хеширования
 * сборки, поэтому строку никогда не хардкодим.
 */
import contentScriptPath from '../content/index.ts?script';
import {
  sendTabMessage,
  onCaptureCrop,
  onRequestInspect,
} from '../lib/messaging.ts';
import type { CropResponse } from '../lib/messaging.ts';
import type { DOMRectLike, DebrandOptions } from '../lib/types.ts';

/** Инжектит content-скрипт в вкладку и запускает инспекцию. Идемпотентно. */
async function injectAndInspect(
  tabId: number,
  fullPage: boolean,
  debrandOpts?: DebrandOptions,
): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: [contentScriptPath],
  });
  // executeScript зарезолвился → слушатель сообщений уже зарегистрирован.
  await sendTabMessage(tabId, { type: 'START_INSPECT', fullPage, debrandOpts });
}

// Сайдбар открываем по клику на иконку (а не автоматически на всех вкладках).
chrome.runtime.onInstalled.addListener(() => {
  // Поведение по умолчанию выключаем — открываем панель явно в onClicked,
  // чтобы тем же кликом успеть инжектить content-скрипт.
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
});

chrome.action.onClicked.addListener((tab) => {
  if (typeof tab.id !== 'number' || typeof tab.windowId !== 'number') return;
  const tabId = tab.id;

  // Открываем сайдбар для текущего окна.
  void chrome.sidePanel.open({ windowId: tab.windowId });

  // Инжектим content-скрипт и запускаем инспекцию (право даёт activeTab по клику).
  injectAndInspect(tabId, false).catch((err: unknown) => {
    // На служебных страницах (chrome://, Web Store) инъекция запрещена — это ок.
    console.warn('[background] не удалось инжектить content-скрипт:', err);
  });
});

/**
 * REQUEST_INSPECT из сайдбара: находим активную вкладку, (пере)инжектим
 * content-скрипт и запускаем инспекцию. Восстанавливает связь, если скрипт умер.
 */
onRequestInspect(async ({ fullPage, debrandOpts }) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (typeof tab?.id !== 'number') {
    return { ok: false, error: 'Нет активной вкладки.' };
  }
  try {
    await injectAndInspect(tab.id, fullPage, debrandOpts);
    return { ok: true };
  } catch {
    return {
      ok: false,
      error:
        'Не удалось внедриться в страницу. На служебных страницах (chrome://, Web Store, страница настроек) инспекция запрещена браузером. Открой обычный сайт и повтори.',
    };
  }
});

/**
 * Снимает видимую область вкладки и вырезает прямоугольник rect.
 *
 * Retina-нюанс: captureVisibleTab отдаёт PNG в ФИЗИЧЕСКИХ пикселях, а rect от
 * getBoundingClientRect — в CSS-пикселях. Поэтому источник на канвасе масштабируем
 * на dpr: src = rect * dpr, dst = (0,0, rect.w*dpr, rect.h*dpr). Иначе на Retina
 * (dpr=2) crop съедет и возьмёт четверть нужной области.
 */
async function captureCrop(rect: DOMRectLike, dpr: number): Promise<CropResponse> {
  // windowId не передаём — captureVisibleTab берёт активное окно по умолчанию.
  const dataUrl = await chrome.tabs.captureVisibleTab({ format: 'png' });
  const resp = await fetch(dataUrl);
  const pngBlob = await resp.blob();
  const bitmap = await createImageBitmap(pngBlob);

  // Размер вывода — в физических пикселях (чёткий crop на Retina).
  const outW = Math.max(1, Math.round(rect.width * dpr));
  const outH = Math.max(1, Math.round(rect.height * dpr));

  const canvas = new OffscreenCanvas(outW, outH);
  const ctx = canvas.getContext('2d');
  if (!ctx) return { ok: false, error: 'OffscreenCanvas 2d context недоступен' };

  // Источник на скриншоте — координаты rect, умноженные на dpr.
  ctx.drawImage(
    bitmap,
    Math.round(rect.left * dpr),
    Math.round(rect.top * dpr),
    outW,
    outH,
    0,
    0,
    outW,
    outH,
  );
  bitmap.close();

  const outBlob = await canvas.convertToBlob({ type: 'image/png' });
  const buf = await outBlob.arrayBuffer();
  // base64 без префикса data: — бэкенд/LLM ожидают чистый base64.
  // Конвертируем чанками: spread большого массива в btoa переполнит стек.
  const bytes = new Uint8Array(buf);
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  const base64 = btoa(binary);
  return { ok: true, base64 };
}

onCaptureCrop((msg) => captureCrop(msg.rect, msg.dpr));


