/**
 * Экран настроек сайдбара с вкладками:
 *  - «Модель»  — выбор провайдера (OpenAI / Claude / OpenAI-compat) + BYOK-поля;
 *  - «Вид»     — тема (светлая/тёмная/системная) + тюнинг генерации;
 *  - «Связь»   — URL бэкенда и моста;
 *  - «Как пользоваться» — пошаговая инструкция.
 *
 * Ключ хранится локально в chrome.storage.local и уходит на бэкенд как passthrough.
 */
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  KeyRound,
  Eye,
  EyeOff,
  Check,
  Sun,
  Moon,
  Monitor,
  Palette,
  Plug,
  BookOpen,
  MousePointerClick,
  Sparkles,
  FileDown,
  Languages,
} from 'lucide-react';
import {
  DEFAULT_SETTINGS,
  getSettings,
  setSettings,
  isByokReady,
  type ProviderChoice,
  type ThemeChoice,
  type LanguageChoice,
  type Settings,
} from '../lib/settings.ts';
import { applyTheme } from '../lib/theme.ts';
import { useI18n, type TranslationKey, type TFunction } from '../lib/i18n.ts';

const PROVIDERS: Array<{ value: ProviderChoice; label: string; hint: TranslationKey }> = [
  { value: 'openai', label: 'OpenAI', hint: 'settings.model.openaiHint' },
  { value: 'claude', label: 'Claude', hint: 'settings.model.claudeHint' },
  { value: 'openai-compat', label: 'OpenAI-compat', hint: 'settings.model.compatHint' },
];

const THEMES: Array<{ value: ThemeChoice; label: TranslationKey; Icon: typeof Sun }> = [
  { value: 'light', label: 'settings.view.light', Icon: Sun },
  { value: 'dark', label: 'settings.view.dark', Icon: Moon },
  { value: 'system', label: 'settings.view.system', Icon: Monitor },
];

const LANGUAGES: Array<{ value: LanguageChoice; label: string }> = [
  { value: 'en', label: 'English' },
  { value: 'ru', label: 'Русский' },
];

type Tab = 'model' | 'view' | 'connection' | 'guide';

const TABS: Array<{ value: Tab; label: TranslationKey; Icon: typeof KeyRound }> = [
  { value: 'model', label: 'settings.tab.model', Icon: KeyRound },
  { value: 'view', label: 'settings.tab.view', Icon: Palette },
  { value: 'connection', label: 'settings.tab.connection', Icon: Plug },
  { value: 'guide', label: 'settings.tab.guide', Icon: BookOpen },
];

const SPRING = { type: 'spring' as const, stiffness: 400, damping: 32 };

interface Props {
  onClose: () => void;
}

export function SettingsPanel({ onClose }: Props) {
  const { t } = useI18n();
  const [s, setS] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<Tab>('model');

  useEffect(() => {
    void getSettings().then((loadedSettings) => {
      setS(loadedSettings);
      setLoaded(true);
    });
  }, []);

  // Автосохранение при изменении (после первичной загрузки).
  useEffect(() => {
    if (!loaded) return;
    const id = setTimeout(() => {
      void setSettings(s).then(() => {
        setSaved(true);
        setTimeout(() => setSaved(false), 1200);
      });
    }, 400);
    return () => clearTimeout(id);
  }, [s, loaded]);

  const patch = (p: Partial<Settings>) => setS((prev) => ({ ...prev, ...p }));

  // Тему применяем мгновенно (превью), не дожидаясь дебаунса сохранения.
  const patchTheme = (theme: ThemeChoice) => {
    applyTheme(theme);
    patch({ theme });
  };

  const needsModel = s.provider === 'openai' || s.provider === 'openai-compat';
  const needsBaseUrl = s.provider === 'openai-compat';
  const byokIncomplete = !isByokReady(s);

  return (
    <div className="flex h-full flex-col bg-base text-fg">
      <header className="flex shrink-0 items-center gap-2 border-b border-line px-4 py-3">
        <button
          onClick={onClose}
          className="flex items-center gap-1 rounded-lg p-1.5 text-fg-muted transition-colors hover:bg-raised hover:text-fg"
          aria-label={t('settings.back')}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-sm font-semibold tracking-tight">{t('settings.title')}</h1>
        <AnimatePresence>
          {saved && (
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="ml-auto flex items-center gap-1 text-[11px] font-medium text-positive"
            >
              <Check className="h-3 w-3" /> {t('settings.saved')}
            </motion.span>
          )}
        </AnimatePresence>
      </header>

      {/* Вкладки */}
      <nav className="flex shrink-0 gap-1 border-b border-line px-2 py-2">
        {TABS.map(({ value, label, Icon }) => {
          const active = tab === value;
          return (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={
                'relative flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-colors ' +
                (active ? 'text-accent' : 'text-fg-subtle hover:text-fg')
              }
            >
              {active && (
                <motion.span
                  layoutId="settings-tab"
                  className="absolute inset-0 -z-10 rounded-lg bg-accent-soft"
                  transition={SPRING}
                />
              )}
              <Icon className="h-3.5 w-3.5" />
              {t(label)}
            </button>
          );
        })}
      </nav>

      <main className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 py-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="flex flex-col gap-5"
          >
            {/* ── Вкладка: Модель ── */}
            {tab === 'model' && (
              <>
                <section>
                  <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
                    <KeyRound className="h-3.5 w-3.5" /> {t('settings.model.title')}
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {PROVIDERS.map((p) => {
                      const active = s.provider === p.value;
                      return (
                        <button
                          key={p.value}
                          onClick={() => patch({ provider: p.value })}
                          className={
                            'flex flex-col items-start rounded-xl border px-2.5 py-2 text-left transition-all ' +
                            (active
                              ? 'border-accent bg-accent-soft'
                              : 'border-line bg-surface hover:border-line-strong')
                          }
                        >
                          <span className="text-xs font-semibold text-fg">{p.label}</span>
                          <span className="text-[10px] leading-tight text-fg-subtle">
                            {t(p.hint)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <motion.section
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-3"
                >
                    {needsBaseUrl && (
                      <label className="flex flex-col gap-1">
                        <span className="text-[11px] font-medium text-fg-muted">{t('settings.model.baseUrl')}</span>
                        <input
                          type="url"
                          value={s.baseUrl}
                          onChange={(e) => patch({ baseUrl: e.target.value })}
                          placeholder="https://api.deepseek.com/v1"
                          className="rounded-lg border border-line bg-base px-2.5 py-1.5 text-xs text-fg outline-none transition-colors focus:border-accent"
                        />
                      </label>
                    )}

                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-medium text-fg-muted">{t('settings.model.apiKey')}</span>
                      <div className="flex items-center gap-1">
                        <input
                          type={showKey ? 'text' : 'password'}
                          value={s.apiKey}
                          onChange={(e) => patch({ apiKey: e.target.value })}
                          placeholder="sk-..."
                          autoComplete="off"
                          className="min-w-0 flex-1 rounded-lg border border-line bg-base px-2.5 py-1.5 text-xs text-fg outline-none transition-colors focus:border-accent"
                        />
                        <button
                          onClick={() => setShowKey((v) => !v)}
                          className="rounded-lg border border-line p-1.5 text-fg-muted transition-colors hover:text-fg"
                          title={showKey ? t('settings.model.hide') : t('settings.model.show')}
                          aria-label={showKey ? t('settings.model.hideKey') : t('settings.model.showKey')}
                        >
                          {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </label>

                    {(needsModel || s.provider === 'claude') && (
                      <label className="flex flex-col gap-1">
                        <span className="text-[11px] font-medium text-fg-muted">
                          {s.provider === 'claude' ? t('settings.model.modelOptional') : t('settings.model.model')}
                        </span>
                        <input
                          type="text"
                          value={s.model}
                          onChange={(e) => patch({ model: e.target.value })}
                          placeholder={
                            s.provider === 'openai'
                              ? 'gpt-4o'
                              : s.provider === 'claude'
                                ? t('settings.model.claudeDefault')
                                : 'deepseek-chat'
                          }
                          className="rounded-lg border border-line bg-base px-2.5 py-1.5 text-xs text-fg outline-none transition-colors focus:border-accent"
                        />
                      </label>
                    )}

                    {byokIncomplete && (
                      <p className="text-[11px] leading-relaxed text-warn">
                        {t('settings.model.incomplete')}
                      </p>
                    )}
                    <p className="text-[10px] leading-relaxed text-fg-subtle">
                      {t('settings.model.keyNote')}
                    </p>
                  </motion.section>
              </>
            )}

            {/* ── Вкладка: Вид ── */}
            {tab === 'view' && (
              <>
                <section>
                  <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
                    <Palette className="h-3.5 w-3.5" /> {t('settings.view.theme')}
                  </p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {THEMES.map(({ value, label, Icon }) => {
                      const active = s.theme === value;
                      return (
                        <button
                          key={value}
                          onClick={() => patchTheme(value)}
                          className={
                            'flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 transition-all ' +
                            (active
                              ? 'border-accent bg-accent-soft'
                              : 'border-line bg-surface hover:border-line-strong')
                          }
                        >
                          <Icon
                            className={'h-5 w-5 ' + (active ? 'text-accent' : 'text-fg-muted')}
                          />
                          <span
                            className={
                              'text-[11px] font-medium ' + (active ? 'text-accent' : 'text-fg-muted')
                            }
                          >
                            {t(label)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section>
                  <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
                    <Languages className="h-3.5 w-3.5" /> {t('settings.view.language')}
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {LANGUAGES.map(({ value, label }) => {
                      const active = s.language === value;
                      return (
                        <button
                          key={value}
                          onClick={() => patch({ language: value })}
                          className={
                            'rounded-xl border px-2.5 py-2 text-xs font-semibold transition-all ' +
                            (active
                              ? 'border-accent bg-accent-soft text-accent'
                              : 'border-line bg-surface text-fg-muted hover:border-line-strong')
                          }
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
                    {t('settings.view.generation')}
                  </p>
                  <div className="flex flex-col gap-1">
                    {([
                      ['animations', 'settings.view.animations'],
                      ['typescript', 'settings.view.typescript'],
                      ['accessibility', 'settings.view.accessibility'],
                    ] as const).map(([key, label]) => (
                      <label
                        key={key}
                        className="flex cursor-pointer items-center gap-2 rounded-lg px-1 py-1.5 text-xs text-fg-muted transition-colors hover:text-fg"
                      >
                        <input
                          type="checkbox"
                          checked={s[key]}
                          onChange={(e) =>
                            patch({ [key]: e.target.checked } as Partial<Settings>)
                          }
                          className="h-3.5 w-3.5 rounded accent-accent"
                        />
                        {t(label)}
                      </label>
                    ))}
                  </div>
                  <label className="mt-2 flex flex-col gap-1">
                    <span className="text-[11px] font-medium text-fg-muted">
                      {t('settings.view.styleHint')}
                    </span>
                    <input
                      type="text"
                      value={s.styleHint}
                      onChange={(e) => patch({ styleHint: e.target.value })}
                      placeholder={t('settings.view.styleHintPlaceholder')}
                      maxLength={200}
                      className="rounded-lg border border-line bg-base px-2.5 py-1.5 text-xs text-fg outline-none transition-colors focus:border-accent"
                    />
                  </label>
                </section>
              </>
            )}

            {/* ── Вкладка: Связь ── */}
            {tab === 'connection' && (
              <section>
                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
                  <Plug className="h-3.5 w-3.5" /> {t('settings.conn.title')}
                </p>
                <div className="flex flex-col gap-2.5">
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-medium text-fg-muted">{t('settings.conn.backendUrl')}</span>
                    <input
                      type="url"
                      value={s.backendUrl}
                      onChange={(e) => patch({ backendUrl: e.target.value })}
                      className="rounded-lg border border-line bg-base px-2.5 py-1.5 text-xs text-fg outline-none transition-colors focus:border-accent"
                    />
                    <span className="text-[10px] text-fg-subtle">
                      {t('settings.conn.backendHint')}
                    </span>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-medium text-fg-muted">
                      {t('settings.conn.bridgeUrl')}
                    </span>
                    <input
                      type="url"
                      value={s.bridgeUrl}
                      onChange={(e) => patch({ bridgeUrl: e.target.value })}
                      className="rounded-lg border border-line bg-base px-2.5 py-1.5 text-xs text-fg outline-none transition-colors focus:border-accent"
                    />
                    <span className="text-[10px] text-fg-subtle">
                      {t('settings.conn.bridgeHint')}
                    </span>
                  </label>
                </div>
              </section>
            )}

            {/* ── Вкладка: Гайд ── */}
            {tab === 'guide' && <Guide t={t} />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

/** Пошаговая инструкция «как пользоваться». */
function Guide({ t }: { t: TFunction }) {
  const steps: Array<{ Icon: typeof MousePointerClick; title: TranslationKey; text: TranslationKey }> = [
    {
      Icon: MousePointerClick,
      title: 'settings.guide.step1.title',
      text: 'settings.guide.step1.text',
    },
    {
      Icon: Sparkles,
      title: 'settings.guide.step2.title',
      text: 'settings.guide.step2.text',
    },
    {
      Icon: FileDown,
      title: 'settings.guide.step3.title',
      text: 'settings.guide.step3.text',
    },
    {
      Icon: KeyRound,
      title: 'settings.guide.step4.title',
      text: 'settings.guide.step4.text',
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
        <BookOpen className="h-3.5 w-3.5" /> {t('settings.guide.title')}
      </p>
      {steps.map(({ Icon, title, text }) => (
        <div
          key={title}
          className="flex gap-3 rounded-xl border border-line bg-surface p-3"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft">
            <Icon className="h-4 w-4 text-accent" />
          </div>
          <div className="flex flex-col gap-0.5">
            <p className="text-xs font-semibold text-fg">{t(title)}</p>
            <p className="text-[11px] leading-relaxed text-fg-muted">{t(text)}</p>
          </div>
        </div>
      ))}
      <div
        className="rounded-xl border p-3 text-[11px] leading-relaxed"
        style={{
          background: 'var(--c-accent-soft)',
          borderColor: 'color-mix(in srgb, var(--c-accent) 30%, transparent)',
          color: 'var(--c-fg-muted)',
        }}
      >
        <span className="font-semibold text-accent">{t('settings.guide.tipLabel')}</span>{' '}
        {t('settings.guide.tip')}
      </div>
    </div>
  );
}