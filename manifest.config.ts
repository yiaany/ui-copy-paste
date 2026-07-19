import {
  defineManifest,
  defineDynamicResource,
} from '@crxjs/vite-plugin';
import pkg from './package.json' with { type: 'json' };

/**
 * Типобезопасный манифест MV3.
 *
 * Доктрина приватности (4): НЕ используем <all_urls> и НЕ объявляем статические
 * content_scripts. Доступ к вкладке — только по клику (activeTab), а сам
 * content-скрипт инжектим программно через chrome.scripting (см. background).
 * Чтобы инжектируемый бандл был загружаем на любой вкладке, объявляем его как
 * динамический web_accessible_resource.
 */
export default defineManifest({
  manifest_version: 3,
  name: 'UI Copy-Paste — SaaS Spy & Replicator',
  version: pkg.version,
  description: pkg.description,

  // activeTab — доступ к активной вкладке только после клика юзера (ревью-friendly).
  // scripting — программная инъекция content-скрипта. storage — настройки/кэш.
  permissions: ['activeTab', 'scripting', 'storage', 'sidePanel'],

  // Локальный мост-CLI (запись .tsx на диск) + локальный бэкенд-прокси (LLM).
  // Никаких host-разрешений на чужие сайты (доктрина 4).
  // Бэкенд на 8799 (8787 занят HIVE agent-bridge у юзера).
  host_permissions: ['http://localhost:31337/*', 'http://localhost:8799/*'],

  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },

  // Интерфейс — сайдбар (не popup): не закрывается при клике на страницу.
  side_panel: {
    default_path: 'src/sidebar/index.html',
  },

  icons: {
    '16': 'src/assets/icon-16.png',
    '32': 'src/assets/icon-32.png',
    '48': 'src/assets/icon-48.png',
    '128': 'src/assets/icon-128.png',
  },

  action: {
    default_title: 'UI Copy-Paste: open side panel and pick an element',
    default_icon: {
      '16': 'src/assets/icon-16.png',
      '32': 'src/assets/icon-32.png',
      '48': 'src/assets/icon-48.png',
      '128': 'src/assets/icon-128.png',
    },
  },

  // Делает программно инжектируемый content-бандл (и его чанки) загружаемым на
  // любой вкладке. use_dynamic_url НЕ ставим: при программной инъекции лоадер
  // CRXJS грузит чанк по статическому chrome.runtime.getURL(...), а динамический
  // URL отдаёт ресурс только по случайному GUID — статический путь блокируется,
  // и import() чанка падает (контент-скрипт молча не запускается).
  web_accessible_resources: [
    defineDynamicResource({
      matches: ['<all_urls>'],
    }),
  ],
});
