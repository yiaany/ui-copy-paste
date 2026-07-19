/**
 * Экстрактор DOM (Сессия 3) — ядро «чистого пути».
 *
 * getComputedStyle отдаёт ~300 свойств на узел, 90% — дефолты браузера. Если их
 * не выкинуть, и локальный конвертер, и LLM утонут в шуме. Поэтому:
 *   1) читаем только свойства из WHITELIST (релевантные для верстки);
 *   2) сравниваем со стилями ЭТАЛОННОГО элемента того же тега, снятыми в чистой
 *      iframe-песочнице (без CSS страницы), и выкидываем совпадающие с дефолтом.
 *
 * Конвертер CSS→Tailwind — Сессия 4; здесь только чистый ExtractedNode JSON.
 */
import type { DOMRectLike, ExtractedNode } from '../lib/types.ts';

/**
 * Свойства, влияющие на внешний вид и раскладку. Работаем по белому списку —
 * это на порядок быстрее тотальной фильтрации 300 свойств и сразу режет шум.
 */
const STYLE_WHITELIST: readonly string[] = [
  // раскладка
  'display',
  'flex-direction',
  'flex-wrap',
  'flex-grow',
  'flex-shrink',
  'flex-basis',
  'justify-content',
  'align-items',
  'align-self',
  'align-content',
  'gap',
  'row-gap',
  'column-gap',
  'grid-template-columns',
  'grid-template-rows',
  'grid-auto-flow',
  'order',
  // позиционирование
  'position',
  'top',
  'right',
  'bottom',
  'left',
  'z-index',
  'float',
  // бокс-модель
  'width',
  'height',
  'min-width',
  'min-height',
  'max-width',
  'max-height',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'box-sizing',
  'overflow',
  'overflow-x',
  'overflow-y',
  // рамки и скругления
  'border-top-width',
  'border-right-width',
  'border-bottom-width',
  'border-left-width',
  'border-style',
  'border-top-style',
  'border-right-style',
  'border-bottom-style',
  'border-left-style',
  'border-color',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'border-top-left-radius',
  'border-top-right-radius',
  'border-bottom-left-radius',
  'border-bottom-right-radius',
  // цвет и фон
  'color',
  'background-color',
  'background-image',
  'background-size',
  'background-position',
  'background-repeat',
  'opacity',
  // типографика
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'line-height',
  'letter-spacing',
  'text-align',
  'text-decoration-line',
  'text-transform',
  'white-space',
  'text-overflow',
  // эффекты
  'box-shadow',
  'text-shadow',
  'transform',
  'transition',
  'animation',
  'filter',
  'backdrop-filter',
  'cursor',
  'object-fit',
];

/** Атрибуты, которые сохраняем (несут семантику). class/style чистим всегда. */
const KEEP_ATTRS: readonly string[] = [
  'href',
  'src',
  'type',
  'placeholder',
  'alt',
  'title',
  'name',
  'value',
  'role',
  'for',
  'checked',
  'disabled',
  'selected',
  'readonly',
  'data-testid',
];

const MAX_DEPTH = 12;

/** Эталонные стили на тег (из песочницы) — чтобы не пересоздавать на каждый узел. */
const defaultsCache = new Map<string, Record<string, string>>();
let sandboxDoc: Document | null = null;

/** Лениво создаёт скрытый iframe с «чистым» документом без CSS страницы. */
function getSandboxDoc(): Document | null {
  if (sandboxDoc) return sandboxDoc;
  if (typeof document === 'undefined') return null;

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  Object.assign(iframe.style, {
    position: 'fixed',
    width: '0',
    height: '0',
    border: '0',
    opacity: '0',
    pointerEvents: 'none',
    left: '-9999px',
  });
  document.documentElement.appendChild(iframe);
  sandboxDoc = iframe.contentDocument;
  return sandboxDoc;
}

/** Снимает дефолтные стили для тега в песочнице и кэширует их. */
function getTagDefaults(tag: string): Record<string, string> {
  const cached = defaultsCache.get(tag);
  if (cached) return cached;

  const defaults: Record<string, string> = {};
  const doc = getSandboxDoc();
  const view = doc?.defaultView;

  if (doc && view) {
    let el: HTMLElement | null = null;
    try {
      el = doc.createElement(tag);
      doc.body.appendChild(el);
      const cs = view.getComputedStyle(el);
      for (const prop of STYLE_WHITELIST) {
        defaults[prop] = cs.getPropertyValue(prop);
      }
    } catch {
      // Неизвестный/кастомный тег — оставляем пустые дефолты.
    } finally {
      el?.remove();
    }
  }

  defaultsCache.set(tag, defaults);
  return defaults;
}

/** Возвращает только те whitelisted-стили узла, что отличаются от дефолта тега. */
function cleanStyles(el: Element): Record<string, string> {
  const view = el.ownerDocument.defaultView;
  if (!view) return {};

  const cs = view.getComputedStyle(el);
  const defaults = getTagDefaults(el.tagName.toLowerCase());
  const out: Record<string, string> = {};

  for (const prop of STYLE_WHITELIST) {
    const value = cs.getPropertyValue(prop);
    if (!value || value === 'none' || value === 'normal' || value === 'auto') {
      // Пустые и «нулевые» значения не несут информации.
      continue;
    }
    if (value === defaults[prop]) continue; // совпадает с дефолтом тега
    out[prop] = value.trim();
  }
  return out;
}

/** Прямой текст узла: только непосредственные TEXT_NODE-дети, без текста потомков. */
function collectDirectText(el: Element): string | null {
  let text = '';
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      text += child.textContent ?? '';
    }
  }
  const trimmed = text.replace(/\s+/g, ' ').trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Оставляет только семантически значимые атрибуты; data-* кроме data-testid режем. */
function filterAttrs(el: Element): Record<string, string> {
  const out: Record<string, string> = {};
  for (const attr of Array.from(el.attributes)) {
    const name = attr.name.toLowerCase();
    if (name === 'class' || name === 'style' || name === 'id') continue;
    if (KEEP_ATTRS.includes(name) || name.startsWith('aria-')) {
      out[name] = attr.value;
    }
  }
  return out;
}

/** Класс «похож на сгенерённый»: префиксы css-/sc-/jsx-/tw- с цифрами или хеш. */
function looksGenerated(cls: string): boolean {
  // Эмоция/styled/jsx-хелперы: css-1q2w3e, sc-9f8e7d, jsx-1234567, tw-1a2b.
  if (/^(css|sc|jsx|tw)-[a-z0-9]*\d/i.test(cls)) return true;
  // styled-components-хеш вида Component-aB3xY9 (буквы+цифры после дефиса).
  if (/^[a-z]+-[a-z0-9]{5,}$/i.test(cls) && /\d/.test(cls)) return true;
  // Голый хеш: длинный токен из букв и цифр (минимум одна цифра).
  if (/^[a-z0-9]{6,}$/i.test(cls) && /\d/.test(cls) && /[a-z]/i.test(cls)) {
    return true;
  }
  return false;
}

/** className устойчиво к SVGAnimatedString (у <svg> className — объект, не строка). */
function classListOf(el: Element): string[] {
  const raw =
    typeof el.className === 'string'
      ? el.className
      : (el.getAttribute('class') ?? '');
  return raw.trim() ? raw.trim().split(/\s+/) : [];
}

/**
 * Обфусцирован ли элемент: CANVAS (пиксели, не DOM) всегда true; либо >60%
 * классов выглядят сгенерёнными (хеши сборщика) — DOM нечитаемый.
 */
export function isObfuscated(el: Element): boolean {
  if (el.tagName === 'CANVAS') return true;
  const classes = classListOf(el);
  if (classes.length === 0) return false;
  const generated = classes.filter(looksGenerated).length;
  return generated / classes.length > 0.6;
}

/** Скрытые элементы (display:none / visibility:hidden) пропускаем при обходе. */
function isHidden(el: Element): boolean {
  const view = el.ownerDocument.defaultView;
  if (!view) return false;
  const cs = view.getComputedStyle(el);
  return cs.display === 'none' || cs.visibility === 'hidden';
}

function rectToLike(r: DOMRect): DOMRectLike {
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

/**
 * Рекурсивно строит ExtractedNode из элемента.
 * @param el      исходный элемент
 * @param depth   текущая глубина (внешний вызов — 0)
 * @param maxDepth предохранитель от гигантских деревьев
 */
export function extract(el: Element, depth = 0, maxDepth = MAX_DEPTH): ExtractedNode {
  const tag = el.tagName.toLowerCase();

  const node: ExtractedNode = {
    tag,
    textContent: collectDirectText(el),
    attrs: filterAttrs(el),
    styles: cleanStyles(el),
    rect: rectToLike(el.getBoundingClientRect()),
    children: [],
    isObfuscated: isObfuscated(el),
  };

  // <svg>: внутрь не лезем — кладём разметку целиком (замена на lucide — позже).
  if (tag === 'svg') {
    node.svgMarkup = el.outerHTML;
    return node;
  }

  if (depth >= maxDepth) return node;

  for (const child of Array.from(el.children)) {
    if (isHidden(child)) continue;
    node.children.push(extract(child, depth + 1, maxDepth));
  }
  return node;
}

/** Лимиты для режима «вся страница»: глубже и шире, но с потолком по узлам. */
const FULLPAGE_MAX_DEPTH = 20;
const FULLPAGE_MAX_NODES = 1500;

/**
 * Извлечение всей страницы с предохранителем по числу узлов (Сессия 9).
 * Крупный лендинг может дать десятки тысяч узлов — это раздует токены и убьёт
 * LLM. Обходим в ширину по дереву DOM, считаем узлы; при достижении лимита глубже
 * не идём, а сворачиваем остаток в плейсхолдер «… (omitted N nodes)».
 */
export function extractFullPage(
  root: Element,
  maxNodes = FULLPAGE_MAX_NODES,
  maxDepth = FULLPAGE_MAX_DEPTH,
): ExtractedNode {
  let count = 0;

  function walk(el: Element, depth: number): ExtractedNode {
    count += 1;
    const tag = el.tagName.toLowerCase();
    const node: ExtractedNode = {
      tag,
      textContent: collectDirectText(el),
      attrs: filterAttrs(el),
      styles: cleanStyles(el),
      rect: rectToLike(el.getBoundingClientRect()),
      children: [],
      isObfuscated: isObfuscated(el),
    };

    if (tag === 'svg') {
      node.svgMarkup = el.outerHTML;
      return node;
    }
    if (depth >= maxDepth) return node;

    const kids = Array.from(el.children).filter((c) => !isHidden(c));
    let omitted = 0;
    for (const child of kids) {
      if (count >= maxNodes) {
        omitted += 1; // лимит исчерпан — считаем непосещённых детей
        continue;
      }
      node.children.push(walk(child, depth + 1));
    }
    if (omitted > 0) {
      node.children.push({
        tag: 'div',
        textContent: `… (omitted ${omitted} nodes)`,
        attrs: { 'data-placeholder': 'omitted' },
        styles: {},
        rect: { x: 0, y: 0, width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0 },
        children: [],
        isObfuscated: false,
      });
    }
    return node;
  }

  return walk(root, 0);
}
