/**
 * Локальный детерминированный конвертер CSS → Tailwind (Сессия 4, доктрина 3).
 *
 * Вход — очищенные стили ExtractedNode (см. extractor), выход — массив
 * Tailwind-классов. Чем больше мапим здесь, тем меньше токенов и работы у LLM.
 * Не попавшее в шкалы оформляем произвольными значениями (p-[13px], text-[#abc]),
 * чтобы НИЧЕГО не терять. Чистая логика без chrome.* — покрыта юнит-тестами.
 */
import { spacing, DIRECT } from './tailwind-map.ts';

/** Парсит '12px' → 12; '1.5rem' → 24 (rem×16); null, если не длина в px/rem. */
function parsePx(value: string): number | null {
  const v = value.trim();
  const pxMatch = /^(-?\d*\.?\d+)px$/.exec(v);
  if (pxMatch) return parseFloat(pxMatch[1]);
  const remMatch = /^(-?\d*\.?\d+)rem$/.exec(v);
  if (remMatch) return parseFloat(remMatch[1]) * 16;
  return null;
}

/** Конвертирует hex-канал в двухсимвольную строку. */
function toHex2(n: number): string {
  return Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
}

/**
 * rgb(99,102,241) / rgba(99,102,241,0.5) → произвольное значение Tailwind.
 * Непрозрачный цвет → '[#6366f1]', с альфой → '[rgba(...)]' (Tailwind понимает обе формы).
 */
export function toHexArbitrary(color: string): string {
  const m = /^rgba?\(([^)]+)\)$/.exec(color.trim());
  if (!m) {
    // уже hex или именованный цвет — оборачиваем как произвольное значение
    return `[${color.trim().replace(/\s+/g, '')}]`;
  }
  const parts = m[1].split(',').map((p) => p.trim());
  const [r, g, b] = parts.map((p) => parseFloat(p));
  const a = parts[3] !== undefined ? parseFloat(parts[3]) : 1;
  if (a < 1) {
    // С прозрачностью — сохраняем как есть, без потерь.
    return `[rgba(${r},${g},${b},${a})]`;
  }
  return `[#${toHex2(r)}${toHex2(g)}${toHex2(b)}]`;
}

/** Цвет «прозрачный»? Тогда класс не нужен. */
function isTransparent(value: string): boolean {
  const v = value.trim();
  if (v === 'transparent') return true;
  const m = /^rgba?\(([^)]+)\)$/.exec(v);
  if (m) {
    const parts = m[1].split(',').map((p) => p.trim());
    if (parts[3] !== undefined && parseFloat(parts[3]) === 0) return true;
  }
  return false;
}

/** font-size в px → text-xs..text-3xl по ближайшему порогу. */
function fontSizeClass(px: number): string {
  const scale: Array<[number, string]> = [
    [12, 'text-xs'],
    [14, 'text-sm'],
    [16, 'text-base'],
    [18, 'text-lg'],
    [20, 'text-xl'],
    [24, 'text-2xl'],
    [30, 'text-3xl'],
    [36, 'text-4xl'],
    [48, 'text-5xl'],
    [60, 'text-6xl'],
  ];
  for (const [threshold, cls] of scale) {
    if (px <= threshold) return cls;
  }
  return `text-[${px}px]`;
}

/** border-radius в px → rounded-* по шкале. */
function radiusClass(px: number): string {
  const scale: Array<[number, string]> = [
    [0, 'rounded-none'],
    [2, 'rounded-sm'],
    [4, 'rounded'],
    [6, 'rounded-md'],
    [8, 'rounded-lg'],
    [12, 'rounded-xl'],
    [16, 'rounded-2xl'],
    [24, 'rounded-3xl'],
  ];
  for (const [threshold, cls] of scale) {
    if (px <= threshold) return cls;
  }
  if (px >= 9999) return 'rounded-full';
  return `rounded-[${px}px]`;
}

/** box-shadow → shadow-* по «силе» (грубо, по наличию и размеру). */
function shadowClass(value: string): string {
  if (value === 'none') return '';
  // Берём суммарную «величину» теней по числам — больше блюр/спред → крупнее тень.
  const nums = (value.match(/-?\d*\.?\d+px/g) ?? []).map((n) => parseFloat(n));
  const spread = nums.reduce((a, b) => a + Math.abs(b), 0);
  if (spread <= 4) return 'shadow-sm';
  if (spread <= 10) return 'shadow';
  if (spread <= 20) return 'shadow-md';
  if (spread <= 35) return 'shadow-lg';
  if (spread <= 60) return 'shadow-xl';
  return 'shadow-2xl';
}

/** opacity '0.5' → 'opacity-50'. */
function opacityClass(value: string): string {
  const n = parseFloat(value);
  if (Number.isNaN(n)) return '';
  const pct = Math.round(n * 100);
  return `opacity-${pct}`;
}

/** Соответствие свойства-отступа префиксу Tailwind. */
const SPACING_PREFIX: Readonly<Record<string, string>> = {
  'padding-top': 'pt',
  'padding-right': 'pr',
  'padding-bottom': 'pb',
  'padding-left': 'pl',
  'margin-top': 'mt',
  'margin-right': 'mr',
  'margin-bottom': 'mb',
  'margin-left': 'ml',
  gap: 'gap',
  'row-gap': 'gap-y',
  'column-gap': 'gap-x',
  width: 'w',
  height: 'h',
  'min-width': 'min-w',
  'min-height': 'min-h',
  'max-width': 'max-w',
  'max-height': 'max-h',
};

/** Цветовые свойства → префикс утилиты. */
const COLOR_PREFIX: Readonly<Record<string, string>> = {
  color: 'text',
  'background-color': 'bg',
  'border-color': 'border',
  'border-top-color': 'border-t',
  'border-bottom-color': 'border-b',
  'border-left-color': 'border-l',
  'border-right-color': 'border-r',
};

/** Преобразует одно свойство+значение в ноль или несколько Tailwind-классов. */
function mapDeclaration(prop: string, value: string): string[] {
  // 1) Прямые соответствия (display, flex, justify, align, position, ...).
  const direct = DIRECT[prop]?.[value];
  if (direct) return [direct];

  // 2) Отступы/размеры через spacing-шкалу.
  const spacingPrefix = SPACING_PREFIX[prop];
  if (spacingPrefix) {
    const px = parsePx(value);
    if (px !== null) {
      const token = spacing(px);
      // Отрицательные margin: -mt-4.
      if (px < 0) return [`-${spacingPrefix}-${spacing(-px)}`];
      return [`${spacingPrefix}-${token}`];
    }
    return [`${spacingPrefix}-[${value.replace(/\s+/g, '')}]`];
  }

  // 3) Цвета.
  const colorPrefix = COLOR_PREFIX[prop];
  if (colorPrefix) {
    if (isTransparent(value)) {
      return prop === 'background-color' ? ['bg-transparent'] : [];
    }
    return [`${colorPrefix}-${toHexArbitrary(value)}`];
  }

  // 4) Спец-случаи по свойству.
  switch (prop) {
    case 'font-size': {
      const px = parsePx(value);
      return px !== null ? [fontSizeClass(px)] : [`text-[${value}]`];
    }
    case 'border-top-left-radius':
    case 'border-top-right-radius':
    case 'border-bottom-left-radius':
    case 'border-bottom-right-radius':
    case 'border-radius': {
      const px = parsePx(value);
      return px !== null ? [radiusClass(px)] : [`rounded-[${value}]`];
    }
    case 'border-top-width':
    case 'border-right-width':
    case 'border-bottom-width':
    case 'border-left-width': {
      const side = prop.split('-')[1][0]; // t/r/b/l
      const px = parsePx(value);
      if (px === null || px === 0) return [];
      return px === 1 ? [`border-${side}`] : [`border-${side}-[${px}px]`];
    }
    case 'box-shadow':
      return shadowClass(value) ? [shadowClass(value)] : [];
    case 'opacity':
      return opacityClass(value) ? [opacityClass(value)] : [];
    case 'z-index': {
      const n = parseInt(value, 10);
      return Number.isNaN(n) ? [`z-[${value}]`] : [`z-[${n}]`];
    }
    case 'line-height': {
      const px = parsePx(value);
      if (px !== null) return [`leading-[${px}px]`];
      return [`leading-[${value}]`];
    }
    case 'font-family':
      // Семейство шрифта почти всегда уникально — произвольным значением.
      return [`font-[${value.split(',')[0].trim().replace(/['"\s]/g, '_')}]`];
    default:
      break;
  }

  // 5) Фолбэк: произвольное значение [prop:value] — не теряем ничего.
  const safeValue = value.replace(/\s+/g, '_');
  return [`[${prop}:${safeValue}]`];
}

/**
 * Главная функция: очищенные стили → массив уникальных Tailwind-классов.
 * Порядок свойств сохраняется, дубликаты убираются.
 */
export function cssToTailwind(styles: Record<string, string>): string[] {
  const classes: string[] = [];
  for (const [prop, value] of Object.entries(styles)) {
    if (!value) continue;
    for (const cls of mapDeclaration(prop, value)) {
      if (cls) classes.push(cls);
    }
  }
  // Дедуп с сохранением порядка.
  return Array.from(new Set(classes));
}
