import { describe, it, expect } from 'vitest';
import {
  extractCodeBlock,
  extractComponentName,
  collectWarnings,
} from './extract-code.ts';

describe('extractCodeBlock', () => {
  it('вырезает ```tsx блок из текста с пояснениями', () => {
    const raw = 'Вот компонент:\n```tsx\nexport default function X() { return null; }\n```\nГотово.';
    expect(extractCodeBlock(raw)).toBe('export default function X() { return null; }');
  });

  it('поддерживает ограждение без языка', () => {
    expect(extractCodeBlock('```\nconst a = 1;\n```')).toBe('const a = 1;');
  });

  it('без ограждения возвращает весь текст', () => {
    expect(extractCodeBlock('  const a = 1;  ')).toBe('const a = 1;');
  });
});

describe('extractComponentName', () => {
  it('export default function', () => {
    expect(extractComponentName('export default function LoginForm() {}')).toBe('LoginForm');
  });
  it('export function', () => {
    expect(extractComponentName('export function PriceCard() {}')).toBe('PriceCard');
  });
  it('export const X =', () => {
    expect(extractComponentName('export const TabsPanel = () => {}')).toBe('TabsPanel');
  });
  it('фолбэк Component', () => {
    expect(extractComponentName('const x = 1;')).toBe('Component');
  });
});

describe('collectWarnings', () => {
  it('предупреждает об отсутствии импорта React', () => {
    const w = collectWarnings('export default function X() { return null; }');
    expect(w.some((s) => s.includes('React'))).toBe(true);
  });
  it('нет предупреждений для нормального кода', () => {
    const code = "import React from 'react';\nexport default function X() { return <div/>; }";
    expect(collectWarnings(code)).toHaveLength(0);
  });
});
