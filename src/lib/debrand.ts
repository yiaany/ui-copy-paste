/**
 * Де-брендинг режима «вся страница» (Сессия 9, доктрина 7).
 *
 * Закон защищает конкретное ВЫРАЖЕНИЕ (тексты, фото, логотипы, бренд), но НЕ
 * идею лейаута. Поэтому при fullPage мы сохраняем структуру/сетку/отступы, но
 * детерминированно обезличиваем контент ДО отправки на LLM (модели это не
 * доверяем — доктрина 7). Чистые функции над ExtractedNode, без chrome-API и DOM —
 * полностью покрываются юнит-тестами.
 */
import type { ExtractedNode, DebrandOptions } from './types.ts';

/** Пул lorem-слов для замены проприетарного текста. */
const LOREM = [
  'lorem',
  'ipsum',
  'dolor',
  'sit',
  'amet',
  'consectetur',
  'adipiscing',
  'elit',
  'sed',
  'do',
  'eiusmod',
  'tempor',
  'incididunt',
  'labore',
  'magna',
  'aliqua',
];

/** Теги-контейнеры, считающиеся «шапкой/навигацией» (для эвристики логотипа). */
const HEADER_TAGS = new Set(['header', 'nav']);

/** Генерит lorem-текст примерно той же ДЛИНЫ, что и оригинал (±слово). */
export function loremOfLength(original: string): string {
  const target = original.trim().length;
  if (target === 0) return '';
  const words: string[] = [];
  let len = 0;
  let i = 0;
  while (len < target) {
    const w = LOREM[i % LOREM.length];
    words.push(w);
    len += w.length + 1; // +пробел
    i += 1;
  }
  let out = words.join(' ');
  // Подгоняем длину: обрезаем или дополняем до target.
  if (out.length > target) out = out.slice(0, target).trim();
  // Сохраняем «капитализацию» первой буквы, если оригинал начинался с заглавной.
  if (/^[A-ZА-Я]/.test(original.trim())) {
    out = out.charAt(0).toUpperCase() + out.slice(1);
  }
  return out;
}

/** Короткий осмысленный дженерик по роли узла (заголовок/кнопка/цена). */
function genericForRole(node: ExtractedNode): string | null {
  const tag = node.tag;
  if (/^h[1-6]$/.test(tag)) return 'Heading';
  if (tag === 'button') return 'Call to action';
  if (tag === 'a' && node.attrs.role === 'button') return 'Call to action';
  const t = (node.textContent ?? '').trim();
  // Цена: «$1,299» / «99 ₽» / «€49» → нейтральный плейсхолдер.
  if (/[$€£₽]\s?\d|[\d.,]+\s?(руб|₽|usd|eur)/i.test(t)) return '$ —';
  return null;
}

/** Похоже ли на брендовый/логотип-узел (для stripLogos). */
function looksLikeLogo(node: ExtractedNode, inHeader: boolean): boolean {
  const hay = [
    node.attrs.alt,
    node.attrs['aria-label'],
    node.attrs.title,
    node.attrs.role,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (/\b(brand|logo|логотип|бренд)\b/.test(hay)) return true;
  // svg в шапке/навигации — частый паттерн логотипа.
  if (node.tag === 'svg' && inHeader) return true;
  return false;
}

/** Узел-плейсхолдер для картинки: div с подписью размера, нейтральный фон. */
function imagePlaceholder(node: ExtractedNode): ExtractedNode {
  const w = Math.round(node.rect.width) || 0;
  const h = Math.round(node.rect.height) || 0;
  return {
    tag: 'div',
    textContent: w && h ? `Image ${w}×${h}` : 'Image',
    attrs: { 'data-placeholder': 'image' },
    styles: {
      ...node.styles,
      'background-color': 'rgb(226, 232, 240)', // slate-200
      color: 'rgb(100, 116, 139)', // slate-500
      display: node.styles.display ?? 'flex',
    },
    rect: node.rect,
    children: [],
    isObfuscated: false,
  };
}

/** Есть ли фоновая картинка в стилях. */
function hasBackgroundImage(node: ExtractedNode): boolean {
  const bg = node.styles['background-image'];
  return !!bg && /url\(/i.test(bg);
}

/** Простая нейтрализация палитры: любой цвет → slate, сохраняя светлоту. */
function neutralizeColor(value: string): string {
  const m = /^rgba?\(([^)]+)\)/.exec(value.trim());
  if (!m) return value;
  const parts = m[1].split(',').map((p) => parseFloat(p));
  const [r, g, b] = parts;
  if ([r, g, b].some((n) => Number.isNaN(n))) return value;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  // Маппим светлоту на шкалу slate (тёмный→светлый), сохраняя контраст.
  const slate: Array<[number, string]> = [
    [0.1, 'rgb(15, 23, 42)'], // slate-900
    [0.25, 'rgb(51, 65, 85)'], // slate-700
    [0.45, 'rgb(100, 116, 139)'], // slate-500
    [0.7, 'rgb(148, 163, 184)'], // slate-400
    [0.9, 'rgb(226, 232, 240)'], // slate-200
    [1.01, 'rgb(248, 250, 252)'], // slate-50
  ];
  for (const [threshold, color] of slate) {
    if (lum <= threshold) {
      // Сохраняем альфу, если была.
      if (parts[3] !== undefined) {
        const c = /\(([^)]+)\)/.exec(color)![1];
        return `rgba(${c}, ${parts[3]})`;
      }
      return color;
    }
  }
  return value;
}

/** Нейтрализует цветовые свойства узла (фон/текст/рамка). */
function neutralizeStyles(styles: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = { ...styles };
  for (const prop of ['color', 'background-color', 'border-color']) {
    if (out[prop]) out[prop] = neutralizeColor(out[prop]);
  }
  return out;
}

/**
 * Рекурсивно обезличивает дерево по опциям. Возвращает НОВОЕ дерево (не мутирует).
 * @param inHeader флаг: узел внутри header/nav (для эвристики логотипа)
 */
function debrandNode(
  node: ExtractedNode,
  opts: DebrandOptions,
  inHeader: boolean,
): ExtractedNode {
  // 1) Логотипы/брендовые svg → дженерик-маркер иконки.
  if (opts.stripLogos && looksLikeLogo(node, inHeader)) {
    return {
      tag: node.tag === 'svg' ? 'svg' : 'div',
      textContent: null,
      attrs: { 'data-placeholder': 'logo' },
      styles: node.styles,
      rect: node.rect,
      children: [],
      isObfuscated: false,
      // Маркер для промпта/рендера: заменить на дженерик-иконку lucide.
      svgMarkup: node.tag === 'svg' ? '<!-- generic-logo: Square -->' : undefined,
    };
  }

  // 2) Картинки → плейсхолдеры.
  if (opts.stripImages && (node.tag === 'img' || hasBackgroundImage(node))) {
    if (node.tag === 'img') return imagePlaceholder(node);
    // Фоновая картинка: убираем url(), помечаем, детей сохраняем.
    node = {
      ...node,
      styles: { ...node.styles, 'background-image': 'none', 'background-color': 'rgb(241, 245, 249)' },
    };
  }

  // 3) Текст → дженерик по роли или lorem той же длины.
  let textContent = node.textContent;
  if (opts.loremText && textContent && textContent.trim().length > 0) {
    const generic = genericForRole(node);
    textContent = generic ?? loremOfLength(textContent);
  }

  // 4) Палитра (опционально).
  const styles = opts.neutralizePalette ? neutralizeStyles(node.styles) : node.styles;

  const nextInHeader = inHeader || HEADER_TAGS.has(node.tag);
  return {
    ...node,
    textContent,
    styles,
    children: node.children.map((c) => debrandNode(c, opts, nextInHeader)),
  };
}

/** Публичная точка входа: обезличивает дерево по опциям. */
export function debrand(node: ExtractedNode, opts: DebrandOptions): ExtractedNode {
  return debrandNode(node, opts, false);
}
