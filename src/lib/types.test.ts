import { describe, it, expect } from 'vitest';
import {
  ExtractedNodeSchema,
  GenerateRequestSchema,
  type ExtractedNode,
} from './types.ts';

/**
 * Smoke-тесты контракта типов. Проверяют, что рекурсивная Zod-схема (z.lazy)
 * собрана корректно и что границы валидации ведут себя ожидаемо.
 * Заодно подтверждают, что Vitest в проекте запускается.
 */
describe('ExtractedNodeSchema', () => {
  const leaf: ExtractedNode = {
    tag: 'span',
    textContent: 'Привет',
    attrs: {},
    styles: { color: 'rgb(0, 0, 0)' },
    rect: { x: 0, y: 0, width: 10, height: 10, top: 0, right: 10, bottom: 10, left: 0 },
    children: [],
    isObfuscated: false,
  };

  it('принимает валидное вложенное дерево', () => {
    const tree: ExtractedNode = { ...leaf, tag: 'div', textContent: null, children: [leaf] };
    expect(ExtractedNodeSchema.parse(tree)).toEqual(tree);
  });

  it('отклоняет узел без обязательных полей', () => {
    expect(ExtractedNodeSchema.safeParse({ tag: 'div' }).success).toBe(false);
  });
});

describe('GenerateRequestSchema', () => {
  it('принимает запрос dom-режима', () => {
    const ok = GenerateRequestSchema.safeParse({
      mode: 'dom',
      viewport: { width: 1280, height: 720 },
    });
    expect(ok.success).toBe(true);
  });

  it('отклоняет неизвестный режим', () => {
    const bad = GenerateRequestSchema.safeParse({
      mode: 'video',
      viewport: { width: 1, height: 1 },
    });
    expect(bad.success).toBe(false);
  });
});
