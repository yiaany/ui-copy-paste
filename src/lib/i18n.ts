/**
 * Локализация интерфейса (i18n).
 *
 * Два языка: английский (по умолчанию) и русский. Словари типобезопасны — ключи
 * задаются одним источником истины (тип `TranslationKey`), поэтому пропуск ключа
 * в любом языке ловится компилятором.
 *
 * Использование:
 *   const { t, lang } = useI18n();
 *   t('header.tagline')
 *   t('export.downloaded', { name: 'Card', ext: 'tsx' })  // подстановка {параметров}
 *
 * Хук `useI18n` подписан на настройки, поэтому смена языка мгновенно
 * перерисовывает весь UI без перезагрузки.
 */
import { useEffect, useState } from 'react';
import {
  getSettings,
  onSettingsChange,
  DEFAULT_SETTINGS,
  type LanguageChoice,
} from './settings.ts';

/** Английский словарь — источник истины для набора ключей. */
const en = {
  // Шапка
  'header.tagline': 'Spy & replicate any UI',
  'header.ownKey': 'own key',
  'header.openSettings': 'Open settings',

  // Режим захвата
  'capture.title': 'Capture mode',
  'capture.element': 'Element',
  'capture.page': 'Full page',
  'capture.pickElement': 'Pick an element',
  'capture.grabPage': 'Capture page',

  // Де-брендинг
  'debrand.title': 'Make it yours — what to neutralize',
  'debrand.stripLogos': 'Remove brand logos',
  'debrand.stripLogosHint': 'Recommended',
  'debrand.stripImages': 'Images → placeholders',
  'debrand.loremText': 'Text → neutral copy',
  'debrand.neutralizePalette': 'Palette → neutral',
  'debrand.note':
    'By default it is a 1:1 copy (layout, styles, text) with brand logos removed. The toggles above add extra anonymization.',

  // Пути генерации
  'path.screenshot': 'Path: screenshot (Canvas/obfuscated) — code available after Generate.',
  'path.dom': 'Path: DOM — local code is ready, AI improves structure and interactivity.',

  // Превью и код
  'preview.title': 'Preview',
  'code.local': 'local',
  'code.ai': 'AI',
  'code.copy': 'Copy',
  'code.copied': 'Copied',
  'code.generating': 'Generating…',
  'code.generateAI': 'Generate (AI)',
  'code.streaming': 'Streaming…',

  // Экспорт
  'export.download': 'Download',
  'export.toProject': 'To project',
  'export.writing': 'Writing…',
  'export.downloaded': '✓ {name}.{ext} downloaded',
  'export.written': '✓ {name}.tsx written',

  // Пустое состояние
  'empty.element':
    'Hover over the page — the element highlights. Click to lock the selection, Esc to cancel.',
  'empty.page':
    'Grabs the skeleton of the whole page. Extraction and anonymization happen in the next steps.',

  // Ошибки / тосты
  'error.connect': 'Could not reach the page. Open a regular site and try again.',
  'error.backendDown':
    'Backend is not running. Launch backend\\start-backend.bat (double-click) — keep the window open, then retry.',
  'error.bridgeDown': 'Bridge is not running. Run `npx ui-copy-paste` in your project root.',
  'error.noData': 'Nothing to generate.',
  'error.writeFailed': 'Could not write the file',

  // Футер
  'footer.mode': 'BYOK · your keys',

  // Настройки — общее
  'settings.title': 'Settings',
  'settings.back': 'Back',
  'settings.saved': 'Saved',
  'settings.tab.model': 'Model',
  'settings.tab.view': 'View',
  'settings.tab.connection': 'Connection',
  'settings.tab.guide': 'Guide',

  // Настройки — модель
  'settings.model.title': 'AI model',
  'settings.model.openaiHint': 'your key, no limit',
  'settings.model.claudeHint': 'your Anthropic key',
  'settings.model.compat': 'OpenAI-compatible',
  'settings.model.compatHint': 'base URL + key + model',
  'settings.model.baseUrl': 'Base URL',
  'settings.model.apiKey': 'API key',
  'settings.model.show': 'Show',
  'settings.model.hide': 'Hide',
  'settings.model.showKey': 'Show key',
  'settings.model.hideKey': 'Hide key',
  'settings.model.model': 'Model',
  'settings.model.modelOptional': 'Model (optional)',
  'settings.model.claudeDefault': 'claude-opus-4-8 (default)',
  'settings.model.incomplete':
    'Fill the required fields for this provider before Generate (AI).',
  'settings.model.keyNote':
    'The key is stored locally in the browser and sent to the backend only for the request. We do not persist it.',

  // Настройки — вид
  'settings.view.theme': 'Theme',
  'settings.view.light': 'Light',
  'settings.view.dark': 'Dark',
  'settings.view.system': 'System',
  'settings.view.language': 'Language',
  'settings.view.generation': 'Generation',
  'settings.view.animations': 'Animations (framer-motion)',
  'settings.view.typescript': 'TypeScript (else JSX)',
  'settings.view.accessibility': 'Accessibility (aria, semantics)',
  'settings.view.styleHint': 'Style hint (optional)',
  'settings.view.styleHintPlaceholder': 'e.g. minimalist, like shadcn/ui, dark theme',

  // Настройки — связь
  'settings.conn.title': 'Connection',
  'settings.conn.backendUrl': 'Backend URL',
  'settings.conn.backendHint': 'Proxy for “Generate (AI)”. Default localhost:8799.',
  'settings.conn.bridgeUrl': 'Bridge URL (Export → Project)',
  'settings.conn.bridgeHint': 'Local bridge writes .tsx into the project. Run: npx ui-copy-paste.',

  // Настройки — гайд
  'settings.guide.title': 'How to use',
  'settings.guide.step1.title': '1. Pick what to copy',
  'settings.guide.step1.text':
    'Open any site, click “Pick an element” and click the block you want. Or “Capture page” for the whole skeleton.',
  'settings.guide.step2.title': '2. Generate code',
  'settings.guide.step2.text':
    'Click “Generate (AI)” — the model builds a React + Tailwind component. DOM path has code instantly, screenshot path after generation.',
  'settings.guide.step3.title': '3. Take the result',
  'settings.guide.step3.text':
    '“Copy” to clipboard, “Download” as a .tsx/.jsx file, “To project” straight into a folder via the local bridge (npx ui-copy-paste).',
  'settings.guide.step4.title': 'Connect your API key',
  'settings.guide.step4.text':
    'Model tab → pick OpenAI / Claude / OpenAI-compatible and paste your key. Generation uses your subscription only.',
  'settings.guide.tipLabel': 'Tip:',
  'settings.guide.tip':
    'system pages (chrome://, Chrome Web Store) are protected by the browser — inspection is unavailable there. Open a regular site.',
} as const;

/** Ключ перевода — выводится из английского словаря. */
export type TranslationKey = keyof typeof en;

/** Русский словарь: те же ключи (проверяется компилятором). */
const ru: Record<TranslationKey, string> = {
  'header.tagline': 'Копируй любой UI',
  'header.ownKey': 'свой ключ',
  'header.openSettings': 'Открыть настройки',

  'capture.title': 'Режим захвата',
  'capture.element': 'Элемент',
  'capture.page': 'Вся страница',
  'capture.pickElement': 'Выбрать элемент',
  'capture.grabPage': 'Захватить страницу',

  'debrand.title': 'Сделай своим — что обезличить',
  'debrand.stripLogos': 'Убрать брендовые логотипы',
  'debrand.stripLogosHint': 'Рекомендуется',
  'debrand.stripImages': 'Картинки → плейсхолдеры',
  'debrand.loremText': 'Тексты → нейтральные',
  'debrand.neutralizePalette': 'Палитра → нейтральная',
  'debrand.note':
    'По умолчанию — копия 1:1 (лейаут, стили, текст), убраны только брендовые логотипы. Тумблеры выше включают доп. обезличивание.',

  'path.screenshot':
    'Путь: по скриншоту (Canvas/обфускация) — код доступен после «Generate».',
  'path.dom': 'Путь: по DOM — локальный код готов, AI улучшит структуру и интерактив.',

  'preview.title': 'Превью',
  'code.local': 'локально',
  'code.ai': 'AI',
  'code.copy': 'Копировать',
  'code.copied': 'Скопировано',
  'code.generating': 'Генерация…',
  'code.generateAI': 'Generate (AI)',
  'code.streaming': 'Генерируется…',

  'export.download': 'Скачать',
  'export.toProject': 'В проект',
  'export.writing': 'Запись…',
  'export.downloaded': '✓ {name}.{ext} скачан',
  'export.written': '✓ {name}.tsx записан',

  'empty.element':
    'Наведи курсор на странице — элемент подсветится. Клик фиксирует выбор, Esc отменяет.',
  'empty.page':
    'Берёт каркас всей страницы. Извлечение и обезличивание — на следующих этапах.',

  'error.connect': 'Не удалось связаться со страницей. Открой обычный сайт и повтори.',
  'error.backendDown':
    'Бэкенд не запущен. Запусти backend\\start-backend.bat (двойной клик) — окно должно остаться открытым, потом повтори.',
  'error.bridgeDown': 'Мост не запущен. Выполни `npx ui-copy-paste` в корне проекта.',
  'error.noData': 'Нет данных для генерации.',
  'error.writeFailed': 'Не удалось записать файл',

  'footer.mode': 'BYOK · свои ключи',

  'settings.title': 'Настройки',
  'settings.back': 'Назад',
  'settings.saved': 'Сохранено',
  'settings.tab.model': 'Модель',
  'settings.tab.view': 'Вид',
  'settings.tab.connection': 'Связь',
  'settings.tab.guide': 'Гайд',

  'settings.model.title': 'Модель AI',
  'settings.model.openaiHint': 'свой ключ, без лимита',
  'settings.model.claudeHint': 'свой ключ Anthropic',
  'settings.model.compat': 'OpenAI-совместимый',
  'settings.model.compatHint': 'base URL + ключ + модель',
  'settings.model.baseUrl': 'Base URL',
  'settings.model.apiKey': 'API-ключ',
  'settings.model.show': 'Показать',
  'settings.model.hide': 'Скрыть',
  'settings.model.showKey': 'Показать ключ',
  'settings.model.hideKey': 'Скрыть ключ',
  'settings.model.model': 'Модель',
  'settings.model.modelOptional': 'Модель (опц.)',
  'settings.model.claudeDefault': 'claude-opus-4-8 (по умолчанию)',
  'settings.model.incomplete':
    'Заполни обязательные поля для этого провайдера перед Generate (AI).',
  'settings.model.keyNote':
    'Ключ хранится локально в браузере и передаётся на бэкенд только для запроса. Мы его не сохраняем.',

  'settings.view.theme': 'Тема',
  'settings.view.light': 'Светлая',
  'settings.view.dark': 'Тёмная',
  'settings.view.system': 'Система',
  'settings.view.language': 'Язык',
  'settings.view.generation': 'Генерация',
  'settings.view.animations': 'Анимации (framer-motion)',
  'settings.view.typescript': 'TypeScript (иначе JSX)',
  'settings.view.accessibility': 'Доступность (aria, семантика)',
  'settings.view.styleHint': 'Подсказка по стилю (опц.)',
  'settings.view.styleHintPlaceholder': 'напр. минимализм, как shadcn/ui, тёмная тема',

  'settings.conn.title': 'Соединение',
  'settings.conn.backendUrl': 'Backend URL',
  'settings.conn.backendHint': 'Прокси для «Generate (AI)». По умолчанию localhost:8799.',
  'settings.conn.bridgeUrl': 'Bridge URL (Export → Project)',
  'settings.conn.bridgeHint':
    'Локальный мост записывает .tsx в проект. Запуск: npx ui-copy-paste.',

  'settings.guide.title': 'Как пользоваться',
  'settings.guide.step1.title': '1. Выбери, что скопировать',
  'settings.guide.step1.text':
    'Открой любой сайт, нажми «Выбрать элемент» и кликни по нужному блоку. Или «Захватить страницу» для всего каркаса.',
  'settings.guide.step2.title': '2. Сгенерируй код',
  'settings.guide.step2.text':
    'Нажми «Generate (AI)» — модель соберёт React + Tailwind компонент. По DOM код есть сразу, по скриншоту — после генерации.',
  'settings.guide.step3.title': '3. Забери результат',
  'settings.guide.step3.text':
    '«Копировать» — в буфер, «Скачать» — файлом .tsx/.jsx, «В проект» — прямо в папку через локальный мост (npx ui-copy-paste).',
  'settings.guide.step4.title': 'Подключи свой API-ключ',
  'settings.guide.step4.text':
    'Вкладка «Модель» → выбери OpenAI / Claude / OpenAI-совместимый и вставь ключ. Генерация идёт только через твою подписку.',
  'settings.guide.tipLabel': 'Совет:',
  'settings.guide.tip':
    'служебные страницы (chrome://, Chrome Web Store) браузер защищает — инспекция там недоступна. Открой обычный сайт.',
};

const DICTS: Record<LanguageChoice, Record<TranslationKey, string>> = { en, ru };

/** Параметры для подстановки в шаблон вида `{name}`. */
export type TransParams = Record<string, string | number>;

/** Подставляет параметры `{key}` в строку. */
function interpolate(template: string, params?: TransParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    key in params ? String(params[key]) : `{${key}}`,
  );
}

/** Чистая функция перевода (для не-React кода/тестов). */
export function translate(
  lang: LanguageChoice,
  key: TranslationKey,
  params?: TransParams,
): string {
  const dict = DICTS[lang] ?? DICTS.en;
  return interpolate(dict[key] ?? en[key], params);
}

/** Тип функции перевода, прокидываемой в компоненты. */
export type TFunction = (key: TranslationKey, params?: TransParams) => string;

/**
 * React-хук локализации. Читает язык из настроек и подписывается на изменения,
 * поэтому переключение языка мгновенно перерисовывает UI.
 */
export function useI18n(): { t: TFunction; lang: LanguageChoice } {
  const [lang, setLang] = useState<LanguageChoice>(DEFAULT_SETTINGS.language);

  useEffect(() => {
    void getSettings().then((s) => setLang(s.language));
    return onSettingsChange((s) => setLang(s.language));
  }, []);

  const t: TFunction = (key, params) => translate(lang, key, params);
  return { t, lang };
}
