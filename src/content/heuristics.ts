/**
 * Эвристика выбора пути генерации (Сессия 3, доктрина 2).
 *
 * Решение принимает машина, НЕ пользователь:
 *   - 'dom'        — DOM читаемый, идём «чистым путём» (extractor + конвертер);
 *   - 'screenshot' — DOM мусорный/Canvas, идём «грязным путём» (LLM по картинке).
 *
 * Обходим поддерево и считаем долю обфусцированных узлов. Любой <canvas> сразу
 * означает screenshot (там нет DOM-структуры — только пиксели).
 */
import { isObfuscated } from './extractor.ts';
import type { GenerateMode } from '../lib/types.ts';

/** Выше этой доли обфусцированных узлов DOM считаем нечитаемым. */
const OBFUSCATION_THRESHOLD = 0.4;

/** Предел обхода — на огромных деревьях доли всё равно стабилизируются. */
const MAX_NODES = 2000;

export interface ModeDecision {
  mode: GenerateMode;
  /** Доля обфусцированных узлов в обойдённом поддереве (0..1). */
  obfuscatedRatio: number;
  /** Найден ли <canvas> (форсирует screenshot). */
  hasCanvas: boolean;
  total: number;
}

/** Подробное решение — для логов/отладки и сайдбара. */
export function analyzeMode(root: Element): ModeDecision {
  let total = 0;
  let obfuscated = 0;
  let hasCanvas = false;

  // Итеративный обход (без рекурсии) с предохранителем по числу узлов.
  const stack: Element[] = [root];
  while (stack.length > 0 && total < MAX_NODES) {
    const el = stack.pop();
    if (!el) break;
    total += 1;
    if (el.tagName === 'CANVAS') hasCanvas = true;
    if (isObfuscated(el)) obfuscated += 1;
    for (const child of Array.from(el.children)) stack.push(child);
  }

  const obfuscatedRatio = total > 0 ? obfuscated / total : 0;
  const mode: GenerateMode =
    hasCanvas || obfuscatedRatio > OBFUSCATION_THRESHOLD ? 'screenshot' : 'dom';

  return { mode, obfuscatedRatio, hasCanvas, total };
}

/** Короткая форма: только режим. */
export function chooseMode(root: Element): GenerateMode {
  return analyzeMode(root).mode;
}
