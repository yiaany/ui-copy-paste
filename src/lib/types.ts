/**
 * Единый контракт данных между слоями (content → background → backend → LLM).
 * Определяем схемы через Zod и выводим из них TS-типы: одна точка правды
 * и готовая валидация на внешних границах (chrome.runtime, тело HTTP).
 */
import { z } from 'zod';

/** Путь генерации: чистый (DOM читаемый) или грязный (по скриншоту). */
export const GenerateModeSchema = z.enum(['dom', 'screenshot']);
export type GenerateMode = z.infer<typeof GenerateModeSchema>;

/** Сериализуемый аналог DOMRect (DOMRect не переживает structured clone в сообщениях). */
export const DOMRectLikeSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  top: z.number(),
  right: z.number(),
  bottom: z.number(),
  left: z.number(),
});
export type DOMRectLike = z.infer<typeof DOMRectLikeSchema>;

/**
 * Узел DOM, извлечённый content-скриптом.
 * Рекурсивный, поэтому интерфейс объявлен явно, а Zod-схема — через z.lazy.
 */
export interface ExtractedNode {
  /** Имя тега в нижнем регистре, напр. 'div', 'button'. */
  tag: string;
  /** Прямой текст узла (без текста детей) или null. */
  textContent: string | null;
  /** Значимые атрибуты (href, type, aria-* и т.п.); class/style вычищаем отдельно. */
  attrs: Record<string, string>;
  /** Вычисленные стили, уже очищенные от дефолтных значений браузера. */
  styles: Record<string, string>;
  /** Геометрия для эвристик и режима «вся страница». */
  rect: DOMRectLike;
  /** Дочерние узлы в порядке документа. */
  children: ExtractedNode[];
  /** true, если классы/идентификаторы выглядят обфусцированными (хеши сборщика). */
  isObfuscated: boolean;
  /** Сырая SVG-разметка, если узел — иконка/вектор (для распознавания/замены). */
  svgMarkup?: string;
}

export const ExtractedNodeSchema: z.ZodType<ExtractedNode> = z.lazy(() =>
  z.object({
    tag: z.string(),
    textContent: z.string().nullable(),
    attrs: z.record(z.string(), z.string()),
    styles: z.record(z.string(), z.string()),
    rect: DOMRectLikeSchema,
    children: z.array(ExtractedNodeSchema),
    isObfuscated: z.boolean(),
    svgMarkup: z.string().optional(),
  }),
);

/** Размер вьюпорта на момент захвата — нужен LLM для пропорций. */
export const ViewportSchema = z.object({
  width: z.number(),
  height: z.number(),
});
export type Viewport = z.infer<typeof ViewportSchema>;

/**
 * Опции де-брендинга для режима «вся страница» (Сессия 9, доктрина 7).
 * Дефолт — ВЕРНАЯ КОПИЯ минус брендовые логотипы (stripLogos). Остальное
 * обезличивание (картинки/текст/палитра) — опционально, для строго легального
 * каркаса-референса. Доктрина 6 (блок фишинг-страниц логина) от опций НЕ зависит.
 */
export const DebrandOptionsSchema = z.object({
  /** <img>/фоновые картинки → нейтральные плейсхолдеры. */
  stripImages: z.boolean().default(false),
  /** Логотипы/брендовые SVG → дженерик-иконка. */
  stripLogos: z.boolean().default(true),
  /** Проприетарный текст → lorem той же длины. */
  loremText: z.boolean().default(false),
  /** Фирменная палитра → нейтраль (slate/zinc), контраст сохраняется. */
  neutralizePalette: z.boolean().default(false),
});
export type DebrandOptions = z.infer<typeof DebrandOptionsSchema>;

/**
 * Дефолт: копия 1:1, убираются только брендовые логотипы. Дополнительное
 * обезличивание (картинки/текст/палитра) пользователь включает вручную.
 */
export const DEFAULT_DEBRAND_OPTIONS: DebrandOptions = {
  stripImages: false,
  stripLogos: true,
  loremText: false,
  neutralizePalette: false,
};

/** Тело запроса на генерацию, уходит на бэкенд-прокси. */
export const GenerateRequestSchema = z.object({
  mode: GenerateModeSchema,
  /** true — захват всей страницы как обезличенного каркаса (доктрина 7). */
  fullPage: z.boolean().optional(),
  /** Дерево DOM для «чистого пути». */
  dom: ExtractedNodeSchema.optional(),
  /** Base64-кроп скриншота для «грязного пути». */
  screenshotBase64: z.string().optional(),
  viewport: ViewportSchema,
});
export type GenerateRequest = z.infer<typeof GenerateRequestSchema>;

/** Ответ бэкенда: готовый .tsx и метаданные. */
export const GenerateResponseSchema = z.object({
  code: z.string(),
  componentName: z.string(),
  warnings: z.array(z.string()),
});
export type GenerateResponse = z.infer<typeof GenerateResponseSchema>;
