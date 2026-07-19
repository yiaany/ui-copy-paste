/**
 * Content-скрипт (vanilla TS — React тяжёл для инъекции на чужую страницу).
 *
 * Инжектится программно через chrome.scripting по клику на иконку (доктрина 4).
 * Может выполниться повторно при повторных кликах — защищаемся флагом на window
 * и регистрируем слушатель сообщений ровно один раз.
 *
 * Сессия 3: чистый путь (dom) — извлекаем ExtractedNode и шлём NODE_SELECTED.
 * Сессия 7: грязный путь (screenshot) — если chooseMode вернул 'screenshot'
 * (Canvas/обфускация), скроллим элемент в зону видимости, просим background
 * снять crop и шлём NODE_SELECTED со screenshotBase64.
 */
import { onMessage, sendMessage, requestCrop } from '../lib/messaging.ts';
import { startInspect, stopInspect, capturePage } from './inspector.ts';
import { extract, extractFullPage } from './extractor.ts';
import { analyzeMode } from './heuristics.ts';
import { debrand } from '../lib/debrand.ts';
import {
  DEFAULT_DEBRAND_OPTIONS,
  type DOMRectLike,
  type DebrandOptions,
} from '../lib/types.ts';

declare global {
  interface Window {
    __uiCopyPasteInjected__?: boolean;
  }
}

function toRectLike(r: DOMRect): DOMRectLike {
  return {
    x: r.x,
    y: r.y,
    width: r.width,
    height: r.height,
    top: r.top,
    right: r.right,
    bottom: r.bottom,
    left: r.left,
  };
}

/** Полностью ли прямоугольник в пределах вьюпорта. */
function isFullyVisible(r: DOMRect): boolean {
  return (
    r.top >= 0 &&
    r.left >= 0 &&
    r.bottom <= window.innerHeight &&
    r.right <= window.innerWidth
  );
}

/** Ждёт следующий кадр (даём странице отрисоваться после скролла). */
function nextFrame(): Promise<void> {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
}

const viewport = () => ({ width: window.innerWidth, height: window.innerHeight });

/**
 * Снимает crop выбранного элемента (скроллит в зону видимости при необходимости).
 * Используется и для превью (pixel-perfect «как на сайте»), и для screenshot-пути.
 */
async function captureCropFor(el: Element): Promise<string | null> {
  if (!isFullyVisible(el.getBoundingClientRect())) {
    el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
    await nextFrame();
  }
  const rect = el.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const crop = await requestCrop(toRectLike(rect), dpr);
  if (!crop.ok || !crop.base64) {
    console.warn('[ui-copy-paste] crop не удался:', crop.error);
    return null;
  }
  return crop.base64;
}

/**
 * Чистый путь: извлекаем дерево (для кода) И снимаем скриншот (для pixel-perfect
 * превью — реконструкция инлайн-стилями не совпадает 1:1 из-за whitelist стилей,
 * градиентов, шрифтов и псевдоэлементов). Код = DOM, превью = реальный crop.
 */
async function handleDom(el: Element): Promise<void> {
  const node = extract(el);
  console.log('[ui-copy-paste] выбран элемент (dom):', el);
  const screenshotBase64 = await captureCropFor(el);

  void sendMessage({
    type: 'NODE_SELECTED',
    mode: 'dom',
    fullPage: false,
    node,
    screenshotBase64: screenshotBase64 ?? undefined,
    viewport: viewport(),
  }).catch(() => void 0);
}

/** Грязный путь: скриншот — единственный источник (DOM нечитаемый). */
async function handleScreenshot(el: Element): Promise<void> {
  console.log('[ui-copy-paste] выбран элемент (screenshot):', el);
  const screenshotBase64 = await captureCropFor(el);
  if (!screenshotBase64) return;

  void sendMessage({
    type: 'NODE_SELECTED',
    mode: 'screenshot',
    fullPage: false,
    screenshotBase64,
    viewport: viewport(),
  }).catch(() => void 0);
}

/** Маршрутизация выбранного ОДНОГО элемента по решению chooseMode. */
function handleSelected(el: Element): void {
  const decision = analyzeMode(el);
  console.log('[ui-copy-paste] режим:', decision.mode, decision);
  const run =
    decision.mode === 'screenshot' ? handleScreenshot(el) : handleDom(el);
  void run.catch((err: unknown) =>
    console.error('[ui-copy-paste] ошибка обработки выбора:', err),
  );
}

/**
 * Режим «вся страница» (доктрина 7): извлекаем полную структуру с лимитом узлов,
 * детерминированно обезличиваем (debrand) ДО отправки и шлём как mode='dom'.
 * Скриншот не используем — captureVisibleTab покрывает только видимую область.
 */
function handleFullPage(root: Element, opts: DebrandOptions): void {
  const raw = extractFullPage(root);
  const node = debrand(raw, opts);
  console.log('[ui-copy-paste] fullPage: извлечено + обезличено', opts);

  void sendMessage({
    type: 'NODE_SELECTED',
    mode: 'dom',
    fullPage: true,
    node,
    viewport: viewport(),
  }).catch(() => void 0);
}

if (window.__uiCopyPasteInjected__) {
  console.log('[ui-copy-paste] content-скрипт уже активен на этой вкладке.');
} else {
  window.__uiCopyPasteInjected__ = true;
  console.log(
    '[ui-copy-paste] content-скрипт инжектирован. Готов к инспекции (Сессия 9).',
  );

  onMessage((message) => {
    if (message.type !== 'START_INSPECT') return;
    if (message.fullPage) {
      const opts = message.debrandOpts ?? DEFAULT_DEBRAND_OPTIONS;
      // capturePage отдаёт document.body как корень — обезличиваем всю страницу.
      capturePage({ onSelect: (el) => handleFullPage(el, opts) });
    } else {
      startInspect({
        onSelect: (el) => handleSelected(el),
        onCancel: () => console.log('[ui-copy-paste] инспекция отменена (Esc).'),
      });
    }
  });

  // Подчищаем оверлей, если вкладку выгружают посреди инспекции.
  window.addEventListener('pagehide', () => stopInspect(), { once: true });
}

export {};



