/**
 * Применение темы интерфейса к документу.
 *
 * Тема хранится в настройках (light/dark/system). Класс `.dark` вешается на
 * <html>; светлая тема — отсутствие класса. Для 'system' слушаем
 * prefers-color-scheme и обновляемся вживую.
 *
 * applyTheme — идемпотентна, watchTheme — подписка (возвращает отписку).
 */
import type { ThemeChoice } from './settings.ts';

/** Актуальна ли системная тёмная тема. */
function systemPrefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

/** Вычисляет, тёмная ли тема должна быть активной для данного выбора. */
export function resolveDark(theme: ThemeChoice): boolean {
  if (theme === 'dark') return true;
  if (theme === 'light') return false;
  return systemPrefersDark();
}

/** Навешивает/снимает класс .dark на <html> по выбранной теме. */
export function applyTheme(theme: ThemeChoice): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', resolveDark(theme));
}

/**
 * Применяет тему и, если выбран 'system', подписывается на изменения ОС.
 * Возвращает функцию отписки (для useEffect cleanup).
 */
export function watchTheme(theme: ThemeChoice): () => void {
  applyTheme(theme);
  if (theme !== 'system' || typeof window === 'undefined' || !window.matchMedia) {
    return () => void 0;
  }
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  const onChange = (): void => applyTheme('system');
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}