/**
 * Локальный рендер ExtractedNode → JSX (Сессия 4), БЕЗ LLM.
 *
 * Даёт оффлайн-превью «чистого пути»: structure + Tailwind-классы из конвертера.
 * Интерактив (useState, framer-motion) и распознавание иконок — работа LLM
 * (Сессия 6+). Здесь только статический, но осмысленный JSX.
 *
 * Дополнительно renderInlineHtml() — точная визуальная копия инлайн-стилями
 * (для живого превью в сайдбаре: произвольные Tailwind-классы со страницы не
 * попадают в скомпилированный CSS, а инлайн-стили рисуются как есть).
 */
import type { ExtractedNode } from './types.ts';
import { cssToTailwind } from './css-to-tailwind.ts';

/** Void-элементы HTML — самозакрывающиеся в JSX. */
const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

/** HTML-атрибут → JSX-имя (там, где отличается). */
const ATTR_RENAME: Readonly<Record<string, string>> = {
  for: 'htmlFor',
  class: 'className',
  readonly: 'readOnly',
  tabindex: 'tabIndex',
  maxlength: 'maxLength',
  colspan: 'colSpan',
  rowspan: 'rowSpan',
  autocomplete: 'autoComplete',
};

/** Булевы атрибуты — в JSX без значения. */
const BOOLEAN_ATTRS = new Set(['disabled', 'checked', 'selected', 'readonly']);

function indent(depth: number): string {
  return '  '.repeat(depth);
}

/** Экранирует фигурные скобки в тексте (в JSX они особые). */
function escapeText(text: string): string {
  return text.replace(/[{}]/g, (m) => `{'${m}'}`);
}

/** Собирает строку JSX-атрибутов из attrs узла (без className). */
function renderAttrs(attrs: Record<string, string>): string {
  const parts: string[] = [];
  for (const [name, value] of Object.entries(attrs)) {
    const jsxName = ATTR_RENAME[name] ?? name;
    if (BOOLEAN_ATTRS.has(name)) {
      parts.push(jsxName);
    } else {
      parts.push(`${jsxName}="${value.replace(/"/g, '&quot;')}"`);
    }
  }
  return parts.join(' ');
}

/** Рекурсивно рендерит узел в JSX-строку с отступами. */
function renderNode(node: ExtractedNode, depth: number): string {
  const pad = indent(depth);
  const tag = node.tag;

  // <svg> → плейсхолдер-комментарий (замена на lucide-react — Сессия позже).
  if (tag === 'svg') {
    return `${pad}{/* TODO: иконка — заменить на lucide-react */}`;
  }

  const classes = cssToTailwind(node.styles);
  const attrStr = renderAttrs(node.attrs);
  const classAttr = classes.length ? ` className="${classes.join(' ')}"` : '';
  const openAttrs = `${classAttr}${attrStr ? ' ' + attrStr : ''}`;

  // Void-элементы (img/input/br) — самозакрывающиеся.
  if (VOID_TAGS.has(tag)) {
    return `${pad}<${tag}${openAttrs} />`;
  }

  const childrenJsx = node.children.map((c) => renderNode(c, depth + 1));
  const text = node.textContent ? escapeText(node.textContent) : '';

  // Лист без детей: текст инлайн на одной строке.
  if (node.children.length === 0) {
    if (text) return `${pad}<${tag}${openAttrs}>${text}</${tag}>`;
    return `${pad}<${tag}${openAttrs} />`;
  }

  // Узел с детьми: текст (если есть) первой строкой внутри.
  const inner: string[] = [];
  if (text) inner.push(`${indent(depth + 1)}${text}`);
  inner.push(...childrenJsx);
  return `${pad}<${tag}${openAttrs}>\n${inner.join('\n')}\n${pad}</${tag}>`;
}

/** Имя компонента из тега корня (Button, Card, Div...). */
export function componentNameFor(node: ExtractedNode): string {
  const role = node.attrs.role ?? '';
  const base = role || node.tag;
  const cleaned = base.replace(/[^a-z0-9]/gi, ' ').trim();
  const pascal = cleaned
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
  return (pascal || 'Component') + 'Preview';
}

/** Полный .tsx-компонент: ExtractedNode → строка готового файла. */
export function renderJsx(node: ExtractedNode): { code: string; componentName: string } {
  const componentName = componentNameFor(node);
  const body = renderNode(node, 2);
  const code = `export function ${componentName}() {
  return (
${body}
  );
}
`;
  return { code, componentName };
}

// ───────────────────────── превью (инлайн-стили) ─────────────────────────

/** Экранирует значения для безопасной вставки в HTML-разметку превью. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** styles-объект → инлайн-строка style="". */
function inlineStyle(styles: Record<string, string>): string {
  const decls = Object.entries(styles)
    .map(([p, v]) => `${p}:${v}`)
    .join(';');
  return decls;
}

/**
 * Рендер в HTML с инлайн-стилями для ЖИВОГО превью (точная визуальная копия).
 * svg вставляем как есть (svgMarkup).
 *
 * На КОРНЕ (isRoot) сбрасываем свойства, которые ломают превью: позиционирование
 * и фиксированные размеры/отступы вытаскивают элемент из потока, и контейнер
 * схлопывается в ноль (отсюда «белое пустое превью»). Внутри дерева их сохраняем.
 */
const PREVIEW_ROOT_STRIP = new Set([
  'position',
  'top',
  'right',
  'bottom',
  'left',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'width',
  'height',
  'min-width',
  'min-height',
  'max-width',
  'max-height',
  'float',
  'transform',
]);

export function renderInlineHtml(node: ExtractedNode, isRoot = true): string {
  const tag = node.tag;

  if (tag === 'svg' && node.svgMarkup) {
    return node.svgMarkup;
  }

  // На корне выкидываем лейаут-ломающие свойства и нулевую прозрачность.
  let styles = node.styles;
  if (isRoot) {
    styles = Object.fromEntries(
      Object.entries(styles).filter(
        ([p, v]) => !PREVIEW_ROOT_STRIP.has(p) && !(p === 'opacity' && v === '0'),
      ),
    );
  }

  const style = inlineStyle(styles);
  const styleAttr = style ? ` style="${escapeHtml(style)}"` : '';

  // Безопасные атрибуты для превью (href/src/alt и т.п.), без обработчиков.
  const attrParts: string[] = [];
  for (const [name, value] of Object.entries(node.attrs)) {
    if (name.startsWith('on')) continue;
    attrParts.push(`${name}="${escapeHtml(value)}"`);
  }
  const attrStr = attrParts.length ? ' ' + attrParts.join(' ') : '';

  if (VOID_TAGS.has(tag)) {
    return `<${tag}${styleAttr}${attrStr}>`;
  }

  const text = node.textContent ? escapeHtml(node.textContent) : '';
  const childrenHtml = node.children.map((c) => renderInlineHtml(c, false)).join('');
  return `<${tag}${styleAttr}${attrStr}>${text}${childrenHtml}</${tag}>`;
}

/** Относительная яркость цвета rgb()/rgba() в 0..1, либо null. */
export function colorLuminance(color: string): number | null {
  const m = /^rgba?\(([^)]+)\)/.exec(color.trim());
  if (!m) return null;
  const [r, g, b] = m[1].split(',').map((p) => parseFloat(p));
  if ([r, g, b].some((n) => Number.isNaN(n))) return null;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/**
 * Подбирает фон превью под контент: если у корня нет непрозрачного фона, а текст
 * светлый — тёмная подложка (иначе белый текст на белом был бы не виден).
 */
export function previewBackground(node: ExtractedNode): string {
  const bg = node.styles['background-color'];
  const hasOpaqueBg = bg && !/rgba?\([^)]*,\s*0\s*\)/.test(bg);
  if (hasOpaqueBg) return '#f1f5f9';

  const lum = node.styles.color ? colorLuminance(node.styles.color) : null;
  if (lum !== null && lum > 0.6) return '#1e293b'; // светлый текст → тёмный фон
  return '#f1f5f9';
}

/** Собирает самодостаточный HTML-документ для iframe-превью. */
export function buildPreviewDoc(node: ExtractedNode): string {
  const body = renderInlineHtml(node, true);
  const bg = previewBackground(node);
  return `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;padding:16px;background:${bg};font-family:ui-sans-serif,system-ui,sans-serif;}
*{box-sizing:border-box;}
img{max-width:100%;}
</style></head><body>${body}</body></html>`;
}

