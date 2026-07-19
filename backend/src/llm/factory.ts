/**
 * Фабрика LLM-провайдеров.
 *
 * Только BYOK — пользователь принёс свой ключ (openai/claude/openai-compat).
 * Ключ приходит в теле запроса, живёт только на время запроса, не сохраняется.
 */
import type { LlmProvider } from './provider.ts';
import type { Byok } from '../schema.ts';
import { AnthropicProvider } from './anthropic.ts';
import { OpenAICompatProvider } from './openai-compat.ts';

/** Создаёт провайдер под BYOK-конфиг пользователя (ключ только на этот запрос). */
export function createByokProvider(byok: Byok): LlmProvider {
  switch (byok.provider) {
    case 'claude':
      return new AnthropicProvider(byok.apiKey, byok.model);
    case 'openai':
      return new OpenAICompatProvider({
        apiKey: byok.apiKey,
        model: byok.model ?? 'gpt-4o',
        label: 'openai (byok)',
      });
    case 'openai-compat':
      return new OpenAICompatProvider({
        baseURL: byok.baseUrl,
        apiKey: byok.apiKey,
        model: byok.model ?? '',
        label: 'openai-compat (byok)',
      });
    default: {
      const _never: never = byok.provider;
      throw new Error(`Неизвестный BYOK-провайдер: ${String(_never)}`);
    }
  }
}
