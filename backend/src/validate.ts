/**
 * Валидатор сгенерированного кода (Сессия 8, фича «надёжность»).
 *
 * Прогоняем результат через esbuild.transform с loader 'tsx' — это ловит
 * синтаксические ошибки (незакрытые теги, битый JSX, кривой TS) до того, как
 * код уйдёт пользователю. Семантику (несуществующие импорты) esbuild на одном
 * файле не проверяет — это закрывает fix-imports.
 */
import { transform } from 'esbuild';

export interface ValidationResult {
  ok: boolean;
  /** Человекочитаемый текст ошибки (передаём в repair-промпт). */
  error?: string;
}

/** true, если код парсится как TSX. Иначе ok:false + текст ошибки esbuild. */
export async function validateTsx(code: string): Promise<ValidationResult> {
  try {
    await transform(code, {
      loader: 'tsx',
      jsx: 'automatic',
      // Только парсинг/трансформ — не бандлим, импорты не резолвим.
    });
    return { ok: true };
  } catch (err) {
    // esbuild кидает объект с массивом errors[{text, location}].
    const e = err as { errors?: Array<{ text: string; location?: { line: number; column: number } }> };
    if (e.errors && e.errors.length > 0) {
      const msg = e.errors
        .map((x) => {
          const loc = x.location ? ` (строка ${x.location.line})` : '';
          return `${x.text}${loc}`;
        })
        .join('; ');
      return { ok: false, error: msg };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Неизвестная ошибка парсинга',
    };
  }
}
