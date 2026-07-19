/**
 * Извлечение готового кода из сырого ответа LLM (Сессия 6). Чистая логика.
 *
 * Модель просили вернуть ровно один ```tsx ... ``` блок. На практике она может
 * добавить пояснения вокруг — вырезаем первый огороженный блок; если ограждения
 * нет, берём весь текст как есть.
 */

/** Вырезает первый ```tsx/```jsx/``` блок; иначе — весь текст (обрезанный). */
export function extractCodeBlock(raw: string): string {
  const fenced = /```(?:tsx|jsx|ts|js)?\s*\n([\s\S]*?)```/.exec(raw);
  if (fenced) return fenced[1].trim();
  return raw.trim();
}

/**
 * Достаёт имя компонента из кода: export default function X / export function X /
 * export const X = / function X / const X =. Фолбэк — 'Component'.
 */
export function extractComponentName(code: string): string {
  const patterns: RegExp[] = [
    /export\s+default\s+function\s+([A-Z][A-Za-z0-9_]*)/,
    /export\s+function\s+([A-Z][A-Za-z0-9_]*)/,
    /export\s+const\s+([A-Z][A-Za-z0-9_]*)\s*[:=]/,
    /export\s+default\s+([A-Z][A-Za-z0-9_]*)\s*;/,
    /function\s+([A-Z][A-Za-z0-9_]*)\s*\(/,
    /const\s+([A-Z][A-Za-z0-9_]*)\s*=/,
  ];
  for (const re of patterns) {
    const m = re.exec(code);
    if (m) return m[1];
  }
  return 'Component';
}

/** Простые предупреждения о входе/выходе для GenerateResponse.warnings. */
export function collectWarnings(code: string): string[] {
  const warnings: string[] = [];
  if (!/from\s+['"]react['"]/.test(code)) {
    warnings.push('В коде не найден импорт React — проверь вручную.');
  }
  if (code.length < 40) {
    warnings.push('Ответ модели подозрительно короткий.');
  }
  return warnings;
}
