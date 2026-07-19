/**
 * Настройки расширения, хранятся в chrome.storage.local.
 *
 * Режим генерации — только BYOK: пользователь подключает свой ключ
 * (OpenAI / Claude / OpenAI-совместимый по baseURL). Ключ уходит на бэкенд
 * как passthrough (мы его не храним) и дальше к выбранному провайдеру.
 *
 * ВНИМАНИЕ по безопасности: BYOK-ключ хранится в chrome.storage.local (локально
 * в профиле браузера) и передаётся на бэкенд по HTTPS в проде. Бэкенд обязан НЕ
 * логировать и НЕ сохранять его. Для локали (http://localhost) это приемлемо.
 */

/** Провайдер BYOK. */
export type ProviderChoice = 'openai' | 'claude' | 'openai-compat';

/** Тема интерфейса. 'system' — следовать за настройкой ОС. */
export type ThemeChoice = 'light' | 'dark' | 'system';

/** Язык интерфейса. По умолчанию — английский. */
export type LanguageChoice = 'en' | 'ru';

/** Тюнинг генерации (прокидывается в промпт бэкенда). */
export interface GenerateTuning {
  animations: boolean;
  typescript: boolean;
  accessibility: boolean;
  /** Свободная подсказка по стилю/теме («минимализм», «как shadcn» и т.п.). */
  styleHint: string;
}

/** BYOK-конфиг, уходящий на бэкенд (без лишних полей). */
export interface ByokPayload {
  provider: ProviderChoice;
  apiKey: string;
  /** Обязателен для openai/openai-compat; для claude — опционален (есть дефолт). */
  model?: string;
  /** Только для openai-compat. */
  baseUrl?: string;
}

export interface Settings {
  /** URL бэкенд-прокси (Generate AI). */
  backendUrl: string;
  /** URL локального моста (Export на диск). */
  bridgeUrl: string;
  /** Опциональный Bearer-токен для бэкенда (доступ к shared-инстансу). */
  authToken: string;
  /** Выбранный провайдер BYOK. */
  provider: ProviderChoice;
  /** BYOK: ключ API пользователя. */
  apiKey: string;
  /** BYOK: модель (для openai/openai-compat обязательна). */
  model: string;
  /** BYOK: base URL для openai-compat (напр. https://api.deepseek.com/v1). */
  baseUrl: string;
  /** Относительный путь экспорта внутри проекта. */
  exportPath: string;
  /** Тема интерфейса: светлая / тёмная / системная. */
  theme: ThemeChoice;
  /** Язык интерфейса: английский (по умолчанию) / русский. */
  language: LanguageChoice;
  // ── Тюнинг генерации ──
  animations: boolean;
  typescript: boolean;
  accessibility: boolean;
  styleHint: string;
}

export const DEFAULT_SETTINGS: Settings = {
  backendUrl: 'http://localhost:8799',
  bridgeUrl: 'http://localhost:31337',
  authToken: '',
  provider: 'openai',
  apiKey: '',
  model: 'gpt-4o',
  baseUrl: '',
  exportPath: 'src/components',
  theme: 'system',
  language: 'en',
  animations: true,
  typescript: true,
  accessibility: true,
  styleHint: '',
};

const KEY = 'uicp-settings';

/** Доступен ли chrome.storage (в обычной странице/тесте — нет). */
function hasStorage(): boolean {
  return (
    typeof chrome !== 'undefined' &&
    typeof chrome.storage !== 'undefined' &&
    typeof chrome.storage.local !== 'undefined'
  );
}

/** Нормализует legacy-значение provider: 'free' → 'openai'. */
function normalizeProvider(raw: unknown): ProviderChoice {
  if (raw === 'claude' || raw === 'openai-compat' || raw === 'openai') return raw;
  return 'openai';
}

/** Читает настройки (с подстановкой дефолтов для отсутствующих полей). */
export async function getSettings(): Promise<Settings> {
  if (!hasStorage()) return { ...DEFAULT_SETTINGS };
  const raw = await chrome.storage.local.get(KEY);
  const stored = (raw[KEY] ?? {}) as Partial<Settings> & { provider?: string };
  const merged: Settings = {
    ...DEFAULT_SETTINGS,
    ...stored,
    provider: normalizeProvider(stored.provider),
  };
  return merged;
}

/** Сохраняет (мерджит) настройки. */
export async function setSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  next.provider = normalizeProvider(next.provider);
  if (hasStorage()) await chrome.storage.local.set({ [KEY]: next });
  return next;
}

/** Подписка на изменения настроек (другие вкладки/экран настроек). */
export function onSettingsChange(cb: (s: Settings) => void): () => void {
  if (!hasStorage()) return () => void 0;
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string,
  ): void => {
    if (area === 'local' && changes[KEY]) {
      const stored = (changes[KEY].newValue ?? {}) as Partial<Settings> & {
        provider?: string;
      };
      cb({
        ...DEFAULT_SETTINGS,
        ...stored,
        provider: normalizeProvider(stored.provider),
      });
    }
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

/** Валиден ли BYOK-конфиг (хватает ли полей для выбранного провайдера). */
export function isByokReady(s: Settings): boolean {
  if (!s.apiKey.trim()) return false;
  if (s.provider === 'openai') return s.model.trim().length > 0;
  if (s.provider === 'openai-compat') {
    return s.model.trim().length > 0 && s.baseUrl.trim().length > 0;
  }
  // claude: модель опциональна (есть дефолт на бэкенде).
  return true;
}

/**
 * Собирает BYOK-payload для тела запроса, либо null (неполный конфиг).
 * Пустые опциональные поля не включаем.
 */
export function buildByokPayload(s: Settings): ByokPayload | null {
  if (!isByokReady(s)) return null;
  const payload: ByokPayload = {
    provider: s.provider,
    apiKey: s.apiKey.trim(),
  };
  if (s.model.trim()) payload.model = s.model.trim();
  if (s.provider === 'openai-compat' && s.baseUrl.trim()) {
    payload.baseUrl = s.baseUrl.trim();
  }
  return payload;
}
