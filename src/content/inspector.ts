/**
 * Инспектор (Сессия 2, рефактор в Сессии 3): подсветка по hover + выбор по клику.
 *
 * Работаем в CAPTURE-фазе, чтобы перехватывать события ДО обработчиков сайта
 * (иначе клик «провалится» в кнопки/ссылки страницы). Сам инспектор НЕ извлекает
 * и НЕ шлёт сообщения — он лишь отдаёт выбранный Element через колбэк onSelect.
 * Оркестрацию (extract + chooseMode + NODE_SELECTED) делает content/index.ts.
 *
 * Vanilla TS, без React. Все DOM-узлы оверлея помечены id с префиксом `__uicp`,
 * чтобы инспектор никогда не подсвечивал сам себя.
 */

/** Колбэки режима инспекции — задаются при старте из content/index.ts. */
export interface InspectHandlers {
  /** Пользователь кликнул по элементу (передаём живой Element). */
  onSelect: (el: Element) => void;
  /** Пользователь нажал Esc — выход без выбора. */
  onCancel?: () => void;
}

let handlers: InspectHandlers | null = null;

const OVERLAY_ID = '__uicp-overlay__';
const LABEL_ID = '__uicp-label__';
const STYLE_ID = '__uicp-cursor-style__';

// Максимальный z-index — поверх любого контента сайта.
const Z = 2147483647;

/** Состояние режима инспекции в пределах вкладки. */
let active = false;
let overlayEl: HTMLDivElement | null = null;
let labelEl: HTMLDivElement | null = null;
let cursorStyleEl: HTMLStyleElement | null = null;

/** Последняя позиция курсора + троттлинг через requestAnimationFrame. */
let lastX = 0;
let lastY = 0;
let rafId = 0;
let currentTarget: Element | null = null;

/** Узлы оверлея игнорируем как цель — иначе подсветка зациклится сама на себе. */
function isOwnNode(el: Element | null): boolean {
  if (!el) return true;
  return (
    el.id === OVERLAY_ID || el.id === LABEL_ID || el.closest(`#${OVERLAY_ID}`) !== null
  );
}

/** В режиме одного элемента html/body как цель бессмысленны — пропускаем. */
function isPageRoot(el: Element): boolean {
  return el === document.documentElement || el === document.body;
}

/** Создаёт (один раз) DOM оверлея: рамка-подсветка + плашка с описанием. */
function ensureOverlay(): { overlay: HTMLDivElement; label: HTMLDivElement } {
  if (overlayEl && labelEl) return { overlay: overlayEl, label: labelEl };

  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  Object.assign(overlay.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '0',
    height: '0',
    zIndex: String(Z),
    pointerEvents: 'none',
    boxSizing: 'border-box',
    border: '2px solid #6366f1',
    borderRadius: '4px',
    background: 'rgba(99, 102, 241, 0.12)',
    // Затемняем всё ВНЕ выбранной области (приём DevTools) + мягкое свечение рамки.
    boxShadow:
      '0 0 0 100000px rgba(15, 23, 42, 0.35), 0 0 0 1px rgba(99,102,241,0.6), 0 8px 24px rgba(99,102,241,0.35)',
    // Плавное «перетекание» рамки между элементами.
    transition:
      'top 90ms ease-out, left 90ms ease-out, width 90ms ease-out, height 90ms ease-out',
    opacity: '0',
    visibility: 'hidden',
  } satisfies Partial<CSSStyleDeclaration>);

  const label = document.createElement('div');
  label.id = LABEL_ID;
  Object.assign(label.style, {
    position: 'fixed',
    zIndex: String(Z),
    pointerEvents: 'none',
    boxSizing: 'border-box',
    padding: '3px 8px',
    borderRadius: '6px',
    background: 'linear-gradient(180deg, #6366f1, #4f46e5)',
    color: '#fff',
    font: '600 11px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace',
    letterSpacing: '0.2px',
    whiteSpace: 'nowrap',
    boxShadow: '0 4px 12px rgba(79,70,229,0.45)',
    opacity: '0',
    visibility: 'hidden',
    transition: 'opacity 90ms ease-out, top 90ms ease-out, left 90ms ease-out',
  } satisfies Partial<CSSStyleDeclaration>);

  document.documentElement.append(overlay, label);
  overlayEl = overlay;
  labelEl = label;
  return { overlay, label };
}

/** Короткое человекочитаемое имя элемента: tag#id.class. */
function describe(el: Element, rect: DOMRect): string {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : '';
  const cls =
    typeof el.className === 'string' && el.className.trim()
      ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.')
      : '';
  const size = `${Math.round(rect.width)}×${Math.round(rect.height)}`;
  return `${tag}${id}${cls}  ${size}`;
}

/** Двигает подсветку и плашку к указанному элементу. */
function positionOverlay(el: Element): void {
  const { overlay, label } = ensureOverlay();
  const rect = el.getBoundingClientRect();

  Object.assign(overlay.style, {
    top: `${rect.top}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    opacity: '1',
    visibility: 'visible',
  });

  label.textContent = describe(el, rect);
  // Плашку ставим над элементом, а если он у верхней кромки — под ним.
  const labelTop = rect.top > 24 ? rect.top - 22 : rect.bottom + 6;
  Object.assign(label.style, {
    top: `${Math.max(2, labelTop)}px`,
    left: `${Math.max(2, rect.left)}px`,
    opacity: '1',
    visibility: 'visible',
  });
}

/** rAF-обработчик: вычисляет элемент под курсором и репозиционирует подсветку. */
function flushMove(): void {
  rafId = 0;
  if (!active) return;
  const el = document.elementFromPoint(lastX, lastY);
  if (!el || isOwnNode(el) || isPageRoot(el)) return;
  if (el === currentTarget) return;
  currentTarget = el;
  positionOverlay(el);
}

function onMouseMove(e: MouseEvent): void {
  lastX = e.clientX;
  lastY = e.clientY;
  if (rafId === 0) rafId = requestAnimationFrame(flushMove);
}

/** Блокирует событие сайта целиком (capture + immediate). */
function swallow(e: Event): void {
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
}

function onClick(e: MouseEvent): void {
  swallow(e);
  const target = currentTarget ?? document.elementFromPoint(e.clientX, e.clientY);
  if (!target || isOwnNode(target) || isPageRoot(target)) return;

  const cb = handlers;
  stopInspect();
  // Извлечение и отправку делает content/index.ts через колбэк.
  cb?.onSelect(target);
}

/** Гасим «мусорные» события мыши/клавиатуры, пока активен инспектор. */
function onSuppressed(e: Event): void {
  swallow(e);
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    swallow(e);
    const cb = handlers;
    stopInspect();
    cb?.onCancel?.();
  }
}

/** Принудительный crosshair поверх курсоров сайта (через !important-стиль). */
function setCursor(on: boolean): void {
  if (on) {
    if (cursorStyleEl) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `*, *::before, *::after { cursor: crosshair !important; }`;
    document.documentElement.appendChild(style);
    cursorStyleEl = style;
  } else {
    cursorStyleEl?.remove();
    cursorStyleEl = null;
  }
}

/** Запускает режим инспекции одного элемента. */
export function startInspect(cbs: InspectHandlers): void {
  if (active) return;
  active = true;
  handlers = cbs;
  currentTarget = null;
  ensureOverlay();
  setCursor(true);

  // capture:true — перехват до обработчиков сайта.
  window.addEventListener('mousemove', onMouseMove, true);
  window.addEventListener('click', onClick, true);
  window.addEventListener('mousedown', onSuppressed, true);
  window.addEventListener('mouseup', onSuppressed, true);
  window.addEventListener('keydown', onKeyDown, true);
}

/** Останавливает инспекцию и убирает оверлей/слушатели. */
export function stopInspect(): void {
  if (!active) return;
  active = false;
  handlers = null;
  currentTarget = null;
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }

  window.removeEventListener('mousemove', onMouseMove, true);
  window.removeEventListener('click', onClick, true);
  window.removeEventListener('mousedown', onSuppressed, true);
  window.removeEventListener('mouseup', onSuppressed, true);
  window.removeEventListener('keydown', onKeyDown, true);

  setCursor(false);
  overlayEl?.remove();
  labelEl?.remove();
  overlayEl = null;
  labelEl = null;
}

/**
 * Режим «вся страница» (доктрина 7): без hover-подсветки, сразу отдаём
 * document.body как корень через onSelect. Де-брендинг — Сессия 9.
 */
export function capturePage(cbs: InspectHandlers): void {
  stopInspect();
  if (document.body) cbs.onSelect(document.body);
}
