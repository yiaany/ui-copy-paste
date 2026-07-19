/**
 * Тесты BYOK-логики настроек: валидность конфига по провайдерам и сборка
 * payload для бэкенда (пустые опциональные поля не включаем).
 */
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SETTINGS,
  isByokReady,
  buildByokPayload,
  type Settings,
} from './settings.ts';

const make = (p: Partial<Settings>): Settings => ({ ...DEFAULT_SETTINGS, ...p });

describe('isByokReady', () => {
  it('без apiKey — не готов', () => {
    expect(isByokReady(make({ provider: 'openai', apiKey: '' }))).toBe(false);
  });

  it('openai требует apiKey и model', () => {
    expect(isByokReady(make({ provider: 'openai', apiKey: 'sk-1' }))).toBe(false);
    expect(isByokReady(make({ provider: 'openai', apiKey: 'sk-1', model: 'gpt-4o' }))).toBe(true);
  });

  it('claude требует только apiKey (модель опциональна)', () => {
    expect(isByokReady(make({ provider: 'claude', apiKey: '' }))).toBe(false);
    expect(isByokReady(make({ provider: 'claude', apiKey: 'sk-ant' }))).toBe(true);
  });

  it('openai-compat требует apiKey, model и baseUrl', () => {
    expect(isByokReady(make({ provider: 'openai-compat', apiKey: 'k', model: 'm' }))).toBe(false);
    expect(
      isByokReady(make({ provider: 'openai-compat', apiKey: 'k', model: 'm', baseUrl: 'https://x/v1' })),
    ).toBe(true);
  });

  it('пробелы не считаются валидным значением', () => {
    expect(isByokReady(make({ provider: 'openai', apiKey: '  ', model: 'gpt-4o' }))).toBe(false);
  });
});

describe('buildByokPayload', () => {
  it('неполный конфиг → null', () => {
    expect(buildByokPayload(make({ provider: 'openai', apiKey: 'sk-1' }))).toBeNull();
  });

  it('openai → provider+apiKey+model, без baseUrl', () => {
    const p = buildByokPayload(make({ provider: 'openai', apiKey: ' sk-1 ', model: ' gpt-4o ' }));
    expect(p).toEqual({ provider: 'openai', apiKey: 'sk-1', model: 'gpt-4o' });
  });

  it('claude без модели → только provider+apiKey', () => {
    const p = buildByokPayload(make({ provider: 'claude', apiKey: 'sk-ant' }));
    expect(p).toEqual({ provider: 'claude', apiKey: 'sk-ant' });
  });

  it('openai-compat → включает baseUrl', () => {
    const p = buildByokPayload(
      make({ provider: 'openai-compat', apiKey: 'k', model: 'deepseek-chat', baseUrl: 'https://api.deepseek.com/v1' }),
    );
    expect(p).toEqual({
      provider: 'openai-compat',
      apiKey: 'k',
      model: 'deepseek-chat',
      baseUrl: 'https://api.deepseek.com/v1',
    });
  });
});
