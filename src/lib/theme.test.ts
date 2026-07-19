/**
 * Тесты логики выбора темы. matchMedia мокаем, чтобы проверить ветку 'system'.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { resolveDark } from './theme.ts';

function mockMatchMedia(matches: boolean): void {
  vi.stubGlobal('window', {
    matchMedia: (q: string) => ({ matches, media: q }),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('resolveDark', () => {
  it('явный light/dark не зависит от системы', () => {
    mockMatchMedia(true);
    expect(resolveDark('light')).toBe(false);
    expect(resolveDark('dark')).toBe(true);
  });

  it('system следует за prefers-color-scheme: dark', () => {
    mockMatchMedia(true);
    expect(resolveDark('system')).toBe(true);
  });

  it('system → светлая, если система светлая', () => {
    mockMatchMedia(false);
    expect(resolveDark('system')).toBe(false);
  });
});