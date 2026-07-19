/**
 * Общий интерфейс LLM-провайдера (Сессия 6).
 *
 * Доктрина 1: ключ LLM живёт ТОЛЬКО на бэкенде. Реализации изолированы по файлам
 * (навык claude-api запрещает мешать Anthropic SDK и OpenAI-совместимые шимы в
 * одном файле): anthropic.ts — прод-путь, openai-compat.ts — ВРЕМЕННЫЙ.
 */

/** Мультимодальный блок пользовательского контента (текст или картинка). */
export type UserContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; mediaType: string; base64: string };

export interface GenerateParams {
  system: string;
  content: UserContentBlock[];
  maxTokens: number;
}

export interface LlmProvider {
  /** Человекочитаемое имя провайдера (для логов/health). */
  readonly name: string;
  /** Возвращает сырой текст ответа модели (из него вырежем ```tsx). */
  generate(params: GenerateParams): Promise<string>;
  /**
   * Стриминг: вызывает onDelta на каждый кусок текста по мере генерации,
   * резолвится полным текстом. Опционально — фолбэк на generate(), если не задан.
   */
  generateStream?(
    params: GenerateParams,
    onDelta: (chunk: string) => void,
  ): Promise<string>;
}
