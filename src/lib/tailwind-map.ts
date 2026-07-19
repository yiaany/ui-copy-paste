/**
 * Карты соответствий CSS → Tailwind (Сессия 4).
 *
 * Чистая логика без зависимостей от chrome.* — покрывается юнит-тестами.
 * Принцип (доктрина 3): мапим локально максимум; не попавшее в шкалу оформляем
 * произвольными значениями Tailwind (p-[13px]), чтобы НИЧЕГО не терять.
 */

/**
 * Шкала отступов Tailwind: px → токен (1 = 0.25rem = 4px).
 * Покрывает стандартную spacing-шкалу; всё прочее уходит в произвольное [Npx].
 */
export const SPACING: ReadonlyMap<number, string> = new Map([
  [0, '0'],
  [1, 'px'], // 1px — особый токен Tailwind
  [2, '0.5'],
  [4, '1'],
  [6, '1.5'],
  [8, '2'],
  [10, '2.5'],
  [12, '3'],
  [14, '3.5'],
  [16, '4'],
  [20, '5'],
  [24, '6'],
  [28, '7'],
  [32, '8'],
  [36, '9'],
  [40, '10'],
  [44, '11'],
  [48, '12'],
  [56, '14'],
  [64, '16'],
  [80, '20'],
  [96, '24'],
  [112, '28'],
  [128, '32'],
  [160, '40'],
  [192, '48'],
  [224, '56'],
  [256, '64'],
]);

/**
 * Возвращает spacing-токен для px (например 16 → '4'), либо произвольное
 * значение '[13px]', если точного совпадения в шкале нет.
 */
export function spacing(px: number): string {
  const token = SPACING.get(px);
  if (token !== undefined) return token;
  // Дробные/нестандартные значения — произвольным значением, ничего не теряем.
  const rounded = Math.round(px * 100) / 100;
  return `[${rounded}px]`;
}

/** Прямые соответствия value → префикс-класс для свойств с конечным набором значений. */
export const DIRECT: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  display: {
    block: 'block',
    'inline-block': 'inline-block',
    inline: 'inline',
    flex: 'flex',
    'inline-flex': 'inline-flex',
    grid: 'grid',
    'inline-grid': 'inline-grid',
    contents: 'contents',
    table: 'table',
    none: 'hidden',
  },
  'flex-direction': {
    row: 'flex-row',
    'row-reverse': 'flex-row-reverse',
    column: 'flex-col',
    'column-reverse': 'flex-col-reverse',
  },
  'flex-wrap': {
    wrap: 'flex-wrap',
    'wrap-reverse': 'flex-wrap-reverse',
    nowrap: 'flex-nowrap',
  },
  'justify-content': {
    'flex-start': 'justify-start',
    'flex-end': 'justify-end',
    center: 'justify-center',
    'space-between': 'justify-between',
    'space-around': 'justify-around',
    'space-evenly': 'justify-evenly',
    start: 'justify-start',
    end: 'justify-end',
  },
  'align-items': {
    'flex-start': 'items-start',
    'flex-end': 'items-end',
    center: 'items-center',
    baseline: 'items-baseline',
    stretch: 'items-stretch',
    start: 'items-start',
    end: 'items-end',
  },
  'align-self': {
    auto: 'self-auto',
    'flex-start': 'self-start',
    'flex-end': 'self-end',
    center: 'self-center',
    stretch: 'self-stretch',
    baseline: 'self-baseline',
  },
  'text-align': {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
    justify: 'text-justify',
  },
  'font-weight': {
    '100': 'font-thin',
    '200': 'font-extralight',
    '300': 'font-light',
    '400': 'font-normal',
    '500': 'font-medium',
    '600': 'font-semibold',
    '700': 'font-bold',
    '800': 'font-extrabold',
    '900': 'font-black',
    normal: 'font-normal',
    bold: 'font-bold',
  },
  'font-style': {
    italic: 'italic',
    normal: 'not-italic',
  },
  position: {
    static: 'static',
    relative: 'relative',
    absolute: 'absolute',
    fixed: 'fixed',
    sticky: 'sticky',
  },
  'text-transform': {
    uppercase: 'uppercase',
    lowercase: 'lowercase',
    capitalize: 'capitalize',
    none: 'normal-case',
  },
  'text-decoration-line': {
    underline: 'underline',
    'line-through': 'line-through',
    overline: 'overline',
    none: 'no-underline',
  },
  overflow: {
    auto: 'overflow-auto',
    hidden: 'overflow-hidden',
    visible: 'overflow-visible',
    scroll: 'overflow-scroll',
    clip: 'overflow-clip',
  },
  'object-fit': {
    contain: 'object-contain',
    cover: 'object-cover',
    fill: 'object-fill',
    none: 'object-none',
    'scale-down': 'object-scale-down',
  },
  'white-space': {
    normal: 'whitespace-normal',
    nowrap: 'whitespace-nowrap',
    pre: 'whitespace-pre',
    'pre-line': 'whitespace-pre-line',
    'pre-wrap': 'whitespace-pre-wrap',
  },
};
