import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  SquareMousePointer,
  LayoutTemplate,
  Crosshair,
  TriangleAlert,
  Copy,
  Check,
  Upload,
  FileCode,
  Sparkles,
  Camera,
  Code2,
  ShieldCheck,
  Settings as SettingsIcon,
  Download,
  Zap,
} from 'lucide-react';
import { onMessage, requestInspect } from '../lib/messaging.ts';
import {
  DEFAULT_DEBRAND_OPTIONS,
  type ExtractedNode,
  type GenerateMode,
  type GenerateResponse,
  type DebrandOptions,
} from '../lib/types.ts';
import { renderJsx, buildPreviewDoc } from '../lib/render-jsx.ts';
import { checkBridgeHealth, writeToProject } from '../lib/bridge.ts';
import {
  checkBackendHealth,
  generateComponentStream,
} from '../lib/backend.ts';
import { getSettings, onSettingsChange, type Settings } from '../lib/settings.ts';
import { watchTheme } from '../lib/theme.ts';
import { downloadComponent, fileExtension } from '../lib/download.ts';
import { useI18n, type TranslationKey } from '../lib/i18n.ts';
import { Logo } from './Logo.tsx';
import { SettingsPanel } from './SettingsPanel.tsx';

type CaptureMode = 'element' | 'page';

/** Тип тоста экспорта. */
type Toast = { kind: 'success' | 'error'; text: string } | null;

/** Пружинный transition — единый «характер» движения по всему UI. */
const SPRING = { type: 'spring' as const, stiffness: 400, damping: 32 };

/**
 * Тумблеры де-брендинга. Логотипы — дефолт-вкл (рекомендуется), остальное
 * опционально. Подписи и хинты — по ключам i18n (переводятся на лету).
 */
const DEBRAND_ITEMS: Array<{
  key: keyof DebrandOptions;
  label: TranslationKey;
  hint?: TranslationKey;
}> = [
  { key: 'stripLogos', label: 'debrand.stripLogos', hint: 'debrand.stripLogosHint' },
  { key: 'stripImages', label: 'debrand.stripImages' },
  { key: 'loremText', label: 'debrand.loremText' },
  { key: 'neutralizePalette', label: 'debrand.neutralizePalette' },
];

interface Selection {
  /** Путь генерации, выбранный эвристикой chooseMode. */
  genMode: GenerateMode;
  fullPage: boolean;
  /** Дерево для dom-пути. */
  node: ExtractedNode | null;
  /** base64 PNG для screenshot-пути. */
  screenshotBase64: string | null;
}

export function App() {
  const [mode, setMode] = useState<CaptureMode>('element');
  const [selection, setSelection] = useState<Selection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [generating, setGenerating] = useState(false);
  const [aiResult, setAiResult] = useState<GenerateResponse | null>(null);
  const [streamCode, setStreamCode] = useState('');
  const [debrandOpts, setDebrandOpts] = useState<DebrandOptions>(
    DEFAULT_DEBRAND_OPTIONS,
  );
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettingsState] = useState<Settings | null>(null);
  const { t } = useI18n();

  // Загружаем настройки и подписываемся на изменения (для расширения/download).
  useEffect(() => {
    void getSettings().then(setSettingsState);
    return onSettingsChange(setSettingsState);
  }, []);

  // Применяем тему при загрузке и на каждое изменение настроек/системной темы.
  const theme = settings?.theme;
  useEffect(() => {
    if (!theme) return;
    return watchTheme(theme);
  }, [theme]);

  // Слушаем выбор из content-скрипта (dom-дерево или screenshot).
  useEffect(() => {
    return onMessage((message) => {
      if (message.type === 'NODE_SELECTED') {
        setSelection({
          genMode: message.mode,
          fullPage: message.fullPage,
          node: message.node ?? null,
          screenshotBase64: message.screenshotBase64 ?? null,
        });
        setCopied(false);
        setAiResult(null); // новый выбор — сбрасываем прошлую AI-генерацию
        setToast(null);
      }
    });
  }, []);

  // Локальный рендер (без LLM) — только для dom-пути (даёт код и фолбэк-превью).
  const localRender = useMemo(() => {
    if (!selection?.node) return null;
    const { code, componentName } = renderJsx(selection.node);
    return { code, componentName, previewDoc: buildPreviewDoc(selection.node) };
  }, [selection]);

  // Документ превью: ПРИОРИТЕТ — реальный скриншот (pixel-perfect, «как на сайте»).
  // Инлайн-реконструкция из DOM — фолбэк, если crop не удался (она не совпадает 1:1).
  const previewDoc = useMemo(() => {
    if (selection?.screenshotBase64) {
      return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#0f172a;display:flex;align-items:center;justify-content:center;height:100%}img{max-width:100%;max-height:100%;object-fit:contain}</style></head><body><img src="data:image/png;base64,${selection.screenshotBase64}" alt="crop"/></body></html>`;
    }
    if (localRender) return localRender.previewDoc;
    return null;
  }, [localRender, selection]);

  // Что показываем/копируем/экспортируем. AI-результат имеет приоритет; для
  // screenshot-пути локального кода нет — только после Generate.
  const active = useMemo(() => {
    if (!selection) return null;
    if (aiResult) {
      return {
        code: aiResult.code,
        componentName: aiResult.componentName,
        warnings: aiResult.warnings,
        source: 'ai' as const,
      };
    }
    if (localRender) {
      return {
        code: localRender.code,
        componentName: localRender.componentName,
        warnings: [] as string[],
        source: 'local' as const,
      };
    }
    return null; // screenshot без AI — кода ещё нет
  }, [selection, localRender, aiResult]);

  const handleAction = () => {
    setSelection(null);
    setError(null);
    // Идём через background: он сам (пере)инжектит content-скрипт и запустит
    // инспекцию. Работает, даже если скрипт умер после навигации SPA (YouTube).
    // Для page-режима прокидываем опции де-брендинга (применяются в content).
    void requestInspect(
      mode === 'page',
      mode === 'page' ? debrandOpts : undefined,
    ).then((res) => {
      if (!res.ok) {
        setError(res.error ?? t('error.connect'));
      }
    });
  };

  const handleCopy = () => {
    if (!active) return;
    void navigator.clipboard.writeText(active.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const handleGenerate = async () => {
    if (!selection) return;
    setToast(null);
    setGenerating(true);
    setStreamCode('');
    try {
      const alive = await checkBackendHealth();
      if (!alive) {
        setToast({
          kind: 'error',
          text: t('error.backendDown'),
        });
        return;
      }
      const vp = { width: window.innerWidth, height: window.innerHeight };
      const onDelta = (chunk: string) => setStreamCode((prev) => prev + chunk);

      const outcome =
        selection.genMode === 'screenshot' && selection.screenshotBase64
          ? await generateComponentStream(
              {
                mode: 'screenshot',
                screenshotBase64: selection.screenshotBase64,
                fullPage: selection.fullPage,
                viewport: vp,
              },
              onDelta,
            )
          : selection.node
            ? await generateComponentStream(
                {
                  mode: 'dom',
                  node: selection.node,
                  fullPage: selection.fullPage,
                  viewport: vp,
                },
                onDelta,
              )
            : { ok: false as const, error: t('error.noData') };

      if (outcome.ok) {
        setAiResult(outcome.result);
        setCopied(false);
        if (outcome.result.warnings.length > 0) {
          setToast({ kind: 'error', text: outcome.result.warnings.join(' ') });
        }
      } else {
        setToast({ kind: 'error', text: outcome.error });
      }
    } finally {
      setGenerating(false);
      setStreamCode('');
    }
  };

  const handleDownload = () => {
    if (!active) return;
    const ext = fileExtension(settings?.typescript ?? true);
    downloadComponent(active.componentName, active.code, ext);
    setToast({
      kind: 'success',
      text: t('export.downloaded', { name: active.componentName, ext }),
    });
  };

  const handleExport = async () => {
    if (!active) return;
    setToast(null);
    setExporting(true);
    try {
      // Сначала проверяем, запущен ли мост.
      const alive = await checkBridgeHealth();
      if (!alive) {
        setToast({
          kind: 'error',
          text: t('error.bridgeDown'),
        });
        return;
      }
      const res = await writeToProject(active.componentName, active.code);
      if (res.ok) {
        setToast({
          kind: 'success',
          text: t('export.written', { name: res.componentName ?? active.componentName }),
        });
      } else {
        setToast({ kind: 'error', text: res.error ?? t('error.writeFailed') });
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-base text-fg">
      <AnimatePresence mode="wait">
        {showSettings ? (
          <motion.div
            key="settings"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={SPRING}
            className="flex h-full flex-col"
          >
            <SettingsPanel onClose={() => setShowSettings(false)} />
          </motion.div>
        ) : (
          <motion.div
            key="main"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={SPRING}
            className="flex h-full flex-col"
          >
            {/* Шапка */}
            <header className="relative flex shrink-0 items-center justify-between border-b border-line px-4 py-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent text-accent-fg shadow-accent">
                  <Logo className="h-[18px] w-[18px]" />
                </div>
                <div>
                  <h1 className="text-sm font-semibold leading-tight tracking-tight">
                    UI Replicator
                  </h1>
                  <p className="text-[11px] leading-tight text-fg-subtle">
                    {t('header.tagline')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {settings && settings.apiKey && (
                  <span
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-fg-muted ring-1 ring-line"
                    title={t('header.ownKey')}
                  >
                    <Zap className="h-3 w-3" />
                    {t('header.ownKey')}
                  </span>
                )}
                <button
                  onClick={() => setShowSettings(true)}
                  className="rounded-lg p-2 text-fg-subtle transition-colors hover:bg-raised hover:text-fg"
                  title={t('header.openSettings')}
                  aria-label={t('header.openSettings')}
                >
                  <SettingsIcon className="h-4 w-4" />
                </button>
              </div>
            </header>

            <main className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
              {/* Toggle режима захвата */}
              <div className="shrink-0">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
                  {t('capture.title')}
                </p>
                <div className="relative grid grid-cols-2 gap-1 rounded-2xl bg-surface p-1 ring-1 ring-line">
                  {(['element', 'page'] as const).map((m) => {
                    const activeMode = mode === m;
                    const Icon = m === 'element' ? SquareMousePointer : LayoutTemplate;
                    return (
                      <button
                        key={m}
                        onClick={() => setMode(m)}
                        className={
                          'relative z-10 flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ' +
                          (activeMode ? 'text-accent-fg' : 'text-fg-muted hover:text-fg')
                        }
                      >
                        {activeMode && (
                          <motion.span
                            layoutId="mode-pill"
                            className="absolute inset-0 -z-10 rounded-xl bg-accent shadow-accent"
                            transition={SPRING}
                          />
                        )}
                        <Icon className="h-4 w-4" strokeWidth={2} />
                        {m === 'element' ? t('capture.element') : t('capture.page')}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Панель де-брендинга (только для режима «вся страница») */}
              <AnimatePresence>
                {mode === 'page' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="shrink-0 overflow-hidden rounded-2xl bg-surface ring-1 ring-line"
                  >
                    <div className="flex items-center gap-1.5 border-b border-line px-3 py-2.5 text-xs font-semibold text-fg">
                      <ShieldCheck className="h-4 w-4 text-positive" />
                      {t('debrand.title')}
                    </div>
                    <div className="flex flex-col px-3 py-2">
                      {DEBRAND_ITEMS.map(({ key, label, hint }) => {
                        const on = debrandOpts[key];
                        return (
                          <button
                            type="button"
                            key={key}
                            role="switch"
                            aria-checked={on}
                            onClick={() =>
                              setDebrandOpts((o) => ({ ...o, [key]: !o[key] }))
                            }
                            className="group flex items-center justify-between gap-3 rounded-lg px-1 py-2 text-left transition-colors hover:bg-raised"
                          >
                            <span className="flex items-baseline gap-1.5">
                              <span className="text-xs font-medium text-fg">
                                {t(label)}
                              </span>
                              {hint && (
                                <span className="text-[10px] font-medium text-fg-subtle">
                                  {t(hint)}
                                </span>
                              )}
                            </span>
                            <span
                              className={
                                'relative h-[18px] w-8 shrink-0 rounded-full transition-colors ' +
                                (on ? 'bg-accent' : 'bg-line-strong')
                              }
                            >
                              <motion.span
                                layout
                                transition={SPRING}
                                className={
                                  'absolute top-[2px] h-[14px] w-[14px] rounded-full bg-surface shadow-sm ' +
                                  (on ? 'left-[16px]' : 'left-[2px]')
                                }
                              />
                            </span>
                          </button>
                        );
                      })}
                      <p className="mt-1.5 px-1 text-[11px] leading-relaxed text-fg-subtle">
                        {t('debrand.note')}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Кнопка действия */}
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                transition={SPRING}
                onClick={handleAction}
                className="flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-accent-fg shadow-accent transition-all hover:brightness-95 dark:hover:brightness-110"
              >
                {mode === 'element' ? (
                  <>
                    <Crosshair className="h-4 w-4" />
                    {t('capture.pickElement')}
                  </>
                ) : (
                  <>
                    <LayoutTemplate className="h-4 w-4" />
                    {t('capture.grabPage')}
                  </>
                )}
              </motion.button>

              {/* Ошибка связи с content-скриптом */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="flex shrink-0 items-start gap-2 rounded-xl px-3 py-2.5 text-xs leading-relaxed text-warn ring-1 ring-inset"
                    style={{ background: 'color-mix(in srgb, var(--c-warn) 10%, transparent)', borderColor: 'color-mix(in srgb, var(--c-warn) 30%, transparent)' }}
                  >
                    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Результат: превью + индикатор пути + Generate + код + Export */}
              {selection && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={SPRING}
                  className="flex flex-col gap-3"
                >
                  {/* Индикатор выбранного пути генерации */}
                  <div
                    className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs ring-1 ring-inset"
                    style={
                      selection.genMode === 'screenshot'
                        ? { background: 'color-mix(in srgb, var(--c-info) 10%, transparent)', borderColor: 'color-mix(in srgb, var(--c-info) 28%, transparent)', color: 'var(--c-info)' }
                        : { background: 'var(--c-raised)', borderColor: 'var(--c-line)', color: 'var(--c-fg-muted)' }
                    }
                  >
                    {selection.genMode === 'screenshot' ? (
                      <>
                        <Camera className="h-4 w-4 shrink-0" />
                        {t('path.screenshot')}
                      </>
                    ) : (
                      <>
                        <Code2 className="h-4 w-4 shrink-0" />
                        {t('path.dom')}
                      </>
                    )}
                  </div>

                  {/* Превью: dom → отрендеренный HTML; screenshot → сам PNG */}
                  {previewDoc && (
                    <div>
                      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
                        {t('preview.title')}
                      </p>
                      <iframe
                        title="preview"
                        sandbox=""
                        srcDoc={previewDoc}
                        className="h-44 w-full rounded-xl bg-white ring-1 ring-line"
                      />
                    </div>
                  )}

                  {/* Generate (AI) — через бэкенд */}
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    transition={SPRING}
                    onClick={() => void handleGenerate()}
                    disabled={generating}
                    className="group relative flex items-center justify-center gap-2 overflow-hidden rounded-2xl bg-surface px-4 py-2.5 text-sm font-semibold text-fg ring-1 ring-line transition-colors hover:ring-accent disabled:opacity-60"
                  >
                    {generating && (
                      <span className="shimmer absolute inset-0 -z-0" aria-hidden />
                    )}
                    <Sparkles
                      className={
                        'relative h-4 w-4 text-accent' + (generating ? ' animate-pulse' : '')
                      }
                    />
                    <span className="relative">
                      {generating ? t('code.generating') : t('code.generateAI')}
                    </span>
                  </motion.button>

                  {/* Живой стрим кода во время генерации */}
                  {generating && streamCode && (
                    <div>
                      <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-accent">
                        <Sparkles className="h-3 w-3 animate-pulse" />
                        {t('code.streaming')}
                      </p>
                      <pre className="max-h-72 overflow-auto rounded-xl bg-surface p-3 text-[11px] leading-relaxed text-fg-muted ring-1 ring-line">
                        <code>{streamCode}</code>
                      </pre>
                    </div>
                  )}

                  {/* Сгенерированный код + источник (local/AI) — если есть */}
                  {active && !generating && (
                    <div>
                      <div className="mb-1.5 flex items-center justify-between">
                        <p className="flex items-center gap-1.5 text-xs font-medium text-fg-muted">
                          {active.componentName}.{fileExtension(settings?.typescript ?? true)}
                          <span
                            className={
                              'rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ' +
                              (active.source === 'ai'
                                ? 'text-accent'
                                : 'bg-raised text-fg-subtle')
                            }
                            style={
                              active.source === 'ai'
                                ? { background: 'var(--c-accent-soft)' }
                                : undefined
                            }
                          >
                            {active.source === 'ai' ? t('code.ai') : t('code.local')}
                          </span>
                        </p>
                        <button
                          onClick={handleCopy}
                          className="flex items-center gap-1 rounded-lg bg-raised px-2 py-1 text-[11px] font-medium text-fg-muted transition-colors hover:bg-overlay hover:text-fg"
                        >
                          {copied ? (
                            <>
                              <Check className="h-3 w-3 text-positive" />
                              {t('code.copied')}
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              {t('code.copy')}
                            </>
                          )}
                        </button>
                      </div>
                      <pre className="max-h-72 overflow-auto rounded-xl bg-surface p-3 text-[11px] leading-relaxed text-fg ring-1 ring-line">
                        <code>{active.code}</code>
                      </pre>
                    </div>
                  )}

                  {/* Экспорт: Download (браузер) + Export → Project (мост) — если есть код */}
                  {active && (
                    <div className="grid grid-cols-2 gap-2">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        transition={SPRING}
                        onClick={handleDownload}
                        className="flex items-center justify-center gap-2 rounded-xl bg-surface px-3 py-2.5 text-sm font-semibold text-fg ring-1 ring-line transition-colors hover:ring-accent"
                      >
                        <Download className="h-4 w-4 text-accent" />
                        {t('export.download')}
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        transition={SPRING}
                        onClick={() => void handleExport()}
                        disabled={exporting}
                        className="flex items-center justify-center gap-2 rounded-xl bg-surface px-3 py-2.5 text-sm font-semibold text-fg ring-1 ring-line transition-colors hover:ring-positive disabled:opacity-60"
                      >
                        {exporting ? (
                          <>
                            <FileCode className="h-4 w-4 animate-pulse text-positive" />
                            {t('export.writing')}
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 text-positive" />
                            {t('export.toProject')}
                          </>
                        )}
                      </motion.button>
                    </div>
                  )}

                  {/* Тост результата экспорта/генерации */}
                  <AnimatePresence>
                    {toast && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs leading-relaxed ring-1 ring-inset"
                        style={
                          toast.kind === 'success'
                            ? { background: 'color-mix(in srgb, var(--c-positive) 12%, transparent)', borderColor: 'color-mix(in srgb, var(--c-positive) 30%, transparent)', color: 'var(--c-positive)' }
                            : { background: 'color-mix(in srgb, var(--c-warn) 12%, transparent)', borderColor: 'color-mix(in srgb, var(--c-warn) 30%, transparent)', color: 'var(--c-warn)' }
                        }
                      >
                        {toast.kind === 'success' ? (
                          <Check className="mt-0.5 h-4 w-4 shrink-0" />
                        ) : (
                          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                        )}
                        <span>{toast.text}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}

              {!selection && !error && (
                <div className="mt-2 flex flex-col items-center gap-3 rounded-2xl bg-surface px-4 py-8 text-center ring-1 ring-line">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-soft">
                    {mode === 'element' ? (
                      <Crosshair className="h-5 w-5 text-accent" />
                    ) : (
                      <LayoutTemplate className="h-5 w-5 text-accent" />
                    )}
                  </div>
                  <p className="max-w-[15rem] text-xs leading-relaxed text-fg-muted">
                    {mode === 'element' ? t('empty.element') : t('empty.page')}
                  </p>
                </div>
              )}
            </main>

            <footer className="flex shrink-0 items-center justify-between border-t border-line px-4 py-2 text-[11px] text-fg-subtle">
              <span>v0.2.0</span>
              <span>{t('footer.mode')}</span>
            </footer>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}