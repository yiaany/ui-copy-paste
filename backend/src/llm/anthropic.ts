/**
 * Anthropic-провайдер — ПРОДАКШЕН-путь (доктрина 1, мастер-промпт).
 *
 * Модель claude-opus-4-8, client.messages.stream(...) (стрим обязателен при
 * больших max_tokens — иначе HTTP-таймаут SDK), thinking:{type:'adaptive'} +
 * output_config:{effort:'high'}. budget_tokens НЕ используем (на opus-4-8 это 400).
 * Ключ — только из env ANTHROPIC_API_KEY.
 */
import Anthropic from '@anthropic-ai/sdk';
import type {
  GenerateParams,
  LlmProvider,
  UserContentBlock,
} from './provider.ts';

const DEFAULT_MODEL = 'claude-opus-4-8';

/** Наши мультимодальные блоки → формат Anthropic SDK. */
function toAnthropicContent(
  blocks: UserContentBlock[],
): Anthropic.ContentBlockParam[] {
  return blocks.map((b) => {
    if (b.type === 'text') return { type: 'text', text: b.text };
    return {
      type: 'image',
      source: { type: 'base64', media_type: b.mediaType, data: b.base64 },
    } as Anthropic.ContentBlockParam;
  });
}

export class AnthropicProvider implements LlmProvider {
  readonly name = 'anthropic';
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model?: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model && model.trim() ? model.trim() : DEFAULT_MODEL;
  }

  async generate(params: GenerateParams): Promise<string> {
    // Стрим + get_final_message: безопасно для больших max_tokens.
    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: params.maxTokens,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'high' },
      system: params.system,
      messages: [
        { role: 'user', content: toAnthropicContent(params.content) },
      ],
    });

    const message = await stream.finalMessage();

    // Защита от refusal-остановки (на всякий случай — opus-4-8 редко, но может).
    if (message.stop_reason === 'refusal') {
      throw new Error('Модель отклонила запрос (refusal).');
    }

    // Склеиваем текстовые блоки (thinking-блоки игнорируем).
    return message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
  }

  async generateStream(
    params: GenerateParams,
    onDelta: (chunk: string) => void,
  ): Promise<string> {
    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: params.maxTokens,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'high' },
      system: params.system,
      messages: [{ role: 'user', content: toAnthropicContent(params.content) }],
    });

    // Событие 'text' даёт только дельту видимого текста (не thinking).
    stream.on('text', (delta: string) => onDelta(delta));

    const message = await stream.finalMessage();
    if (message.stop_reason === 'refusal') {
      throw new Error('Модель отклонила запрос (refusal).');
    }
    return message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
  }
}
