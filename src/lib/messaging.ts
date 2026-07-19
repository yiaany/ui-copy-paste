/**
 * Типизированный слой обмена сообщениями поверх chrome.runtime.
 *
 * Все сообщения — дискриминированный union по полю `type`. Валидируем Zod на
 * приёме, потому что chrome.runtime — внешняя граница: на той стороне может
 * оказаться что угодно (другая версия расширения, постороннее расширение).
 */
import { z } from 'zod';
import {
  ExtractedNodeSchema,
  GenerateResponseSchema,
  GenerateModeSchema,
  ViewportSchema,
  DOMRectLikeSchema,
  DebrandOptionsSchema,
} from './types.ts';

/** content → background: запрос crop-скриншота прямоугольника (request/response). */
export const CaptureCropMessageSchema = z.object({
  type: z.literal('CAPTURE_CROP'),
  /** Прямоугольник в CSS-пикселях (getBoundingClientRect). */
  rect: DOMRectLikeSchema,
  /** devicePixelRatio вкладки — скриншот в физ.пикселях, rect в CSS. */
  dpr: z.number(),
});

/** background → content: ответ на CAPTURE_CROP. */
export const CropResponseSchema = z.object({
  ok: z.boolean(),
  /** base64 PNG без префикса data:. */
  base64: z.string().optional(),
  error: z.string().optional(),
});
export type CropResponse = z.infer<typeof CropResponseSchema>;

/** sidebar → background: пользователь нажал «выбрать», запускаем инспектор во вкладке. */
export const StartInspectMessageSchema = z.object({
  type: z.literal('START_INSPECT'),
  /** Захват всей страницы вместо одного элемента (доктрина 7). */
  fullPage: z.boolean().default(false),
  /** Опции де-брендинга для fullPage (применяются в content-скрипте). */
  debrandOpts: DebrandOptionsSchema.optional(),
});

/**
 * sidebar → background: запрос инспекции. Background сам (пере)инжектит content-
 * скрипт в активную вкладку и шлёт START_INSPECT. Самовосстанавливающийся путь —
 * не зависит от того, жив ли content-скрипт с момента клика по иконке (на SPA вроде
 * YouTube он легко теряется). Request/response: ответ говорит, удалось ли.
 */
export const RequestInspectMessageSchema = z.object({
  type: z.literal('REQUEST_INSPECT'),
  fullPage: z.boolean().default(false),
  debrandOpts: DebrandOptionsSchema.optional(),
});

/** background → sidebar: ответ на REQUEST_INSPECT. */
export const RequestInspectResponseSchema = z.object({
  ok: z.boolean(),
  error: z.string().optional(),
});
export type RequestInspectResponse = z.infer<
  typeof RequestInspectResponseSchema
>;

/** content → background/sidebar: пользователь выбрал узел в инспекторе. */
export const NodeSelectedMessageSchema = z.object({
  type: z.literal('NODE_SELECTED'),
  mode: GenerateModeSchema,
  fullPage: z.boolean(),
  node: ExtractedNodeSchema.optional(),
  screenshotBase64: z.string().optional(),
  viewport: ViewportSchema,
});

/** sidebar → background: запрос генерации (background проксирует на бэкенд). */
export const GenerateMessageSchema = z.object({
  type: z.literal('GENERATE'),
  mode: GenerateModeSchema,
  fullPage: z.boolean(),
  node: ExtractedNodeSchema.optional(),
  screenshotBase64: z.string().optional(),
  viewport: ViewportSchema,
});

/** background → sidebar: результат генерации (готовый код или ошибка). */
export const GenerateResultMessageSchema = z.object({
  type: z.literal('GENERATE_RESULT'),
  ok: z.boolean(),
  result: GenerateResponseSchema.optional(),
  error: z.string().optional(),
});

/** Полный union всех сообщений расширения. */
export const MessageSchema = z.discriminatedUnion('type', [
  StartInspectMessageSchema,
  NodeSelectedMessageSchema,
  GenerateMessageSchema,
  GenerateResultMessageSchema,
  CaptureCropMessageSchema,
  RequestInspectMessageSchema,
]);

export type Message = z.infer<typeof MessageSchema>;
export type MessageType = Message['type'];

/** Извлекает конкретный вариант сообщения по его `type`. */
export type MessageOf<T extends MessageType> = Extract<Message, { type: T }>;

/**
 * Отправить типизированное сообщение в runtime (background/sidebar).
 * Ответ не типизируем строго — обработчики у нас, как правило, fire-and-forget
 * и шлют ответ отдельным сообщением (GENERATE_RESULT).
 */
export async function sendMessage(message: Message): Promise<void> {
  await chrome.runtime.sendMessage(message);
}

/** Отправить типизированное сообщение в конкретную вкладку (background → content). */
export async function sendTabMessage(
  tabId: number,
  message: Message,
): Promise<void> {
  await chrome.tabs.sendMessage(tabId, message);
}

/**
 * Подписаться на входящие сообщения с автоматической Zod-валидацией.
 * Невалидные сообщения тихо игнорируем (это могут быть чужие сообщения в шине).
 * Возвращает функцию отписки.
 */
export function onMessage(
  handler: (
    message: Message,
    sender: chrome.runtime.MessageSender,
  ) => void | Promise<void>,
): () => void {
  const listener = (
    raw: unknown,
    sender: chrome.runtime.MessageSender,
  ): undefined => {
    const parsed = MessageSchema.safeParse(raw);
    if (!parsed.success) return undefined;
    // Ошибки в обработчике логируем, но не роняем шину сообщений.
    void Promise.resolve(handler(parsed.data, sender)).catch((err: unknown) => {
      console.error('[messaging] обработчик упал:', err);
    });
    return undefined;
  };

  chrome.runtime.onMessage.addListener(listener);
  return () => chrome.runtime.onMessage.removeListener(listener);
}

/**
 * content → background: запросить crop-скриншот прямоугольника и дождаться ответа.
 * captureVisibleTab доступен только в SW, поэтому content делегирует это туда.
 */
export async function requestCrop(
  rect: z.infer<typeof DOMRectLikeSchema>,
  dpr: number,
): Promise<CropResponse> {
  const raw: unknown = await chrome.runtime.sendMessage({
    type: 'CAPTURE_CROP',
    rect,
    dpr,
  });
  const parsed = CropResponseSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: 'Некорректный ответ на CAPTURE_CROP' };
  }
  return parsed.data;
}

/**
 * background: обработчик CAPTURE_CROP с асинхронным ответом.
 * Возвращаем true из слушателя, чтобы канал sendResponse остался открытым.
 */
export function onCaptureCrop(
  handler: (
    msg: z.infer<typeof CaptureCropMessageSchema>,
    sender: chrome.runtime.MessageSender,
  ) => Promise<CropResponse>,
): () => void {
  const listener = (
    raw: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (r: CropResponse) => void,
  ): boolean | undefined => {
    const parsed = CaptureCropMessageSchema.safeParse(raw);
    if (!parsed.success) return undefined; // не наше сообщение
    handler(parsed.data, sender)
      .then(sendResponse)
      .catch((err: unknown) => {
        sendResponse({
          ok: false,
          error: err instanceof Error ? err.message : 'Ошибка crop',
        });
      });
    return true; // держим канал открытым для асинхронного ответа
  };

  chrome.runtime.onMessage.addListener(listener);
  return () => chrome.runtime.onMessage.removeListener(listener);
}

/**
 * sidebar → background: попросить background (пере)инжектить content-скрипт и
 * запустить инспекцию. Самовосстанавливающийся путь — работает, даже если
 * content-скрипт умер после навигации SPA.
 */
export async function requestInspect(
  fullPage: boolean,
  debrandOpts?: z.infer<typeof DebrandOptionsSchema>,
): Promise<RequestInspectResponse> {
  const raw: unknown = await chrome.runtime.sendMessage({
    type: 'REQUEST_INSPECT',
    fullPage,
    debrandOpts,
  });
  const parsed = RequestInspectResponseSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: 'Некорректный ответ на REQUEST_INSPECT' };
  }
  return parsed.data;
}

/**
 * background: обработчик REQUEST_INSPECT с асинхронным ответом.
 * Возвращаем true из слушателя, чтобы канал sendResponse остался открытым.
 */
export function onRequestInspect(
  handler: (
    msg: z.infer<typeof RequestInspectMessageSchema>,
    sender: chrome.runtime.MessageSender,
  ) => Promise<RequestInspectResponse>,
): () => void {
  const listener = (
    raw: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (r: RequestInspectResponse) => void,
  ): boolean | undefined => {
    const parsed = RequestInspectMessageSchema.safeParse(raw);
    if (!parsed.success) return undefined; // не наше сообщение
    handler(parsed.data, sender)
      .then(sendResponse)
      .catch((err: unknown) => {
        sendResponse({
          ok: false,
          error: err instanceof Error ? err.message : 'Ошибка инспекции',
        });
      });
    return true; // держим канал открытым для асинхронного ответа
  };

  chrome.runtime.onMessage.addListener(listener);
  return () => chrome.runtime.onMessage.removeListener(listener);
}
