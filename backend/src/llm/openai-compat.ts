/**
 * OpenAI-провайдер: работает и с официальным OpenAI, и с любым
 * OpenAI-совместимым endpoint (DeepSeek, Groq, Together, локальные шлюзы и т.п.).
 *
 * baseURL опционален: если не задан — используется дефолтный OpenAI. Ключ, модель
 * и baseURL приходят из BYOK-конфига пользователя или из env shared-провайдера.
 * Изолирован в отдельном файле (не мешаем Anthropic SDK и OpenAI-клиент).
 */
import OpenAI from 'openai';
import type {
  GenerateParams,
  LlmProvider,
  UserContentBlock,
} from './provider.ts';
import type {
  ChatCompletionContentPart,
  ChatCompletionMessageParam,
} from 'openai/resources/chat/completions';

export interface OpenAICompatConfig {
  /** Опционально: base URL для OpenAI-совместимого шлюза. Пусто → OpenAI. */
  baseURL?: string;
  apiKey: string;
  model: string;
  /** Имя для логов/health (напр. 'openai' или 'openai-compat'). */
  label?: string;
}

/** Наши блоки → multimodal-формат OpenAI chat.completions. */
function toOpenAIContent(
  blocks: UserContentBlock[],
): ChatCompletionContentPart[] {
  return blocks.map((b) => {
    if (b.type === 'text') return { type: 'text', text: b.text };
    return {
      type: 'image_url',
      image_url: { url: `data:${b.mediaType};base64,${b.base64}` },
    };
  });
}

export class OpenAICompatProvider implements LlmProvider {
  readonly name: string;
  private client: OpenAI;
  private model: string;

  constructor(config: OpenAICompatConfig) {
    this.client = new OpenAI({
      // baseURL undefined → SDK использует дефолтный OpenAI endpoint.
      baseURL: config.baseURL,
      apiKey: config.apiKey,
    });
    this.model = config.model;
    this.name = config.label ?? (config.baseURL ? 'openai-compat' : 'openai');
  }

  async generate(params: GenerateParams): Promise<string> {
    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: params.system },
      { role: 'user', content: toOpenAIContent(params.content) },
    ];

    const completion = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: params.maxTokens,
      messages,
    });

    return completion.choices[0]?.message?.content ?? '';
  }

  async generateStream(
    params: GenerateParams,
    onDelta: (chunk: string) => void,
  ): Promise<string> {
    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: params.system },
      { role: 'user', content: toOpenAIContent(params.content) },
    ];

    const stream = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: params.maxTokens,
      messages,
      stream: true,
    });

    let full = '';
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? '';
      if (delta) {
        full += delta;
        onDelta(delta);
      }
    }
    return full;
  }
}
