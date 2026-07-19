/**
 * Безопасное разрешение пути для записи .tsx (Сессия 5, доктрина 5).
 *
 * Локальный сервер пишет файлы на диск по СЕТЕВОМУ запросу — это вектор атаки.
 * Любой сайт в браузере юзера может отправить POST. Поэтому:
 *   1) имя компонента жёстко санируем (только [A-Za-z0-9]);
 *   2) итоговый путь обязан лежать ВНУТРИ <cwd>/src/components — проверяем явно
 *      через path.resolve (защита от ../ и абсолютных путей), defense-in-depth.
 *
 * Чистая логика без сети/IO — покрыта юнит-тестами.
 */
import path from 'node:path';

/** Каталог, внутрь которого (и только) разрешена запись. */
export const COMPONENTS_SUBDIR = path.join('src', 'components');

/** Оставляет только латиницу и цифры; пусто/мусор → 'Component'. */
export function sanitizeName(raw: unknown): string {
  const str = typeof raw === 'string' ? raw : '';
  const cleaned = str.replace(/[^A-Za-z0-9]/g, '');
  return cleaned.length > 0 ? cleaned : 'Component';
}

export interface SafePath {
  /** Абсолютный путь к файлу <cwd>/src/components/<Name>.tsx. */
  filePath: string;
  /** Абсолютный путь к каталогу назначения (для mkdir -p). */
  dir: string;
  /** Санированное имя компонента. */
  name: string;
}

/**
 * Строит безопасный путь записи внутри <cwd>/src/components.
 * Бросает Error, если итог выходит за пределы разрешённого каталога.
 */
export function resolveSafePath(cwd: string, rawName: string): SafePath {
  const name = sanitizeName(rawName);
  const dir = path.resolve(cwd, COMPONENTS_SUBDIR);
  const filePath = path.resolve(dir, `${name}.tsx`);

  // Защита от traversal: файл обязан лежать строго внутри dir.
  const prefix = dir + path.sep;
  if (!filePath.startsWith(prefix)) {
    throw new Error('Path traversal: запись вне src/components запрещена');
  }
  return { filePath, dir, name };
}
