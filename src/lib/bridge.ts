/**
 * Клиент локального моста (Сессия 5, настройки в Сессии 10). Расширение →
 * CLI-сервер (порт из настроек). Мост пишет .tsx на диск проекта. Ключа/секретов
 * здесь нет — доверенный localhost (доктрина 5: traversal-защита на сервере).
 */
import { getSettings } from './settings.ts';

/** Проверяет, запущен ли мост (`start-bridge.bat` / `npx ui-copy-paste`). */
export async function checkBridgeHealth(): Promise<boolean> {
  try {
    const { bridgeUrl } = await getSettings();
    const res = await fetch(`${bridgeUrl}/health`, { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
}

export interface WriteResult {
  ok: boolean;
  path?: string;
  componentName?: string;
  error?: string;
}

/** Пишет компонент на диск через мост. */
export async function writeToProject(
  componentName: string,
  code: string,
): Promise<WriteResult> {
  try {
    const { bridgeUrl } = await getSettings();
    const res = await fetch(`${bridgeUrl}/write`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ componentName, code }),
    });
    return (await res.json()) as WriteResult;
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Сеть недоступна',
    };
  }
}

