/**
 * Контракт данных бэкенда (Сессия 6). Зеркалит src/lib/types.ts расширения, но
 * бэкенд автономен и не импортирует из пакета расширения. Валидируем тело HTTP
 * на входе (внешняя граница) — Zod.
 */
import { z } from 'zod';

export const GenerateModeSchema = z.enum(['dom', 'screenshot']);
export type GenerateMode = z.infer<typeof GenerateModeSchema>;

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

export interface ExtractedNode {
  tag: string;
  textContent: string | null;
  attrs: Record<string, string>;
  styles: Record<string, string>;
  rect: z.infer<typeof DOMRectLikeSchema>;
  children: ExtractedNode[];
  isObfuscated: boolean;
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

export const ViewportSchema = z.object({
  width: z.number(),
  height: z.number(),
});

/** Тюнинг генерации из настроек расширения (влияет на промпт). */
export const GenerateTuningSchema = z.object({
  animations: z.boolean().default(true),
  typescript: z.boolean().default(true),
  accessibility: z.boolean().default(true),
  styleHint: z.string().max(500).default(''),
});
export type GenerateTuning = z.infer<typeof GenerateTuningSchema>;

/**
 * BYOK-конфиг: пользователь принёс свой ключ. Валидируем строго — apiKey
 * обязателен; для openai/openai-compat нужна модель, для openai-compat ещё baseUrl.
 */
export const ByokSchema = z
  .object({
    provider: z.enum(['openai', 'claude', 'openai-compat']),
    apiKey: z.string().min(1),
    model: z.string().optional(),
    baseUrl: z.string().url().optional(),
  })
  .refine(
    (v) => (v.provider === 'openai' ? !!v.model : true),
    { message: 'openai требует model' },
  )
  .refine(
    (v) => (v.provider === 'openai-compat' ? !!v.model && !!v.baseUrl : true),
    { message: 'openai-compat требует model и baseUrl' },
  );
export type Byok = z.infer<typeof ByokSchema>;

export const GenerateRequestSchema = z.object({
  mode: GenerateModeSchema,
  fullPage: z.boolean().optional(),
  dom: ExtractedNodeSchema.optional(),
  screenshotBase64: z.string().optional(),
  viewport: ViewportSchema,
  /** BYOK-конфиг (если пользователь подключил свой ключ). */
  byok: ByokSchema.optional(),
  /** Тюнинг генерации из настроек. */
  tuning: GenerateTuningSchema.optional(),
});
export type GenerateRequest = z.infer<typeof GenerateRequestSchema>;

export const GenerateResponseSchema = z.object({
  code: z.string(),
  componentName: z.string(),
  warnings: z.array(z.string()),
});
export type GenerateResponse = z.infer<typeof GenerateResponseSchema>;
