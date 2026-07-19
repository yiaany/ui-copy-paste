import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { getSettings } from '../lib/settings.ts';
import { applyTheme } from '../lib/theme.ts';
import './index.css';

// Применяем сохранённую тему до первого рендера, чтобы не было вспышки светлой.
void getSettings().then((s) => applyTheme(s.theme));

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Не найден #root в сайдбаре');

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
