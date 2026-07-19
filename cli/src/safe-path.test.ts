import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { sanitizeName, resolveSafePath, COMPONENTS_SUBDIR } from './safe-path.ts';

const CWD = path.resolve('/projects/demo');
const ALLOWED = path.resolve(CWD, COMPONENTS_SUBDIR);

describe('sanitizeName', () => {
  it('оставляет только латиницу и цифры', () => {
    expect(sanitizeName('My Button!@#')).toBe('MyButton');
    expect(sanitizeName('Card_v2')).toBe('Cardv2');
  });

  it('вырезает traversal-символы (точки и слэши)', () => {
    expect(sanitizeName('../../evil')).toBe('evil');
    expect(sanitizeName('..\\..\\evil')).toBe('evil');
  });

  it('пустое/мусорное имя → Component', () => {
    expect(sanitizeName('')).toBe('Component');
    expect(sanitizeName('../')).toBe('Component');
    expect(sanitizeName(null)).toBe('Component');
    expect(sanitizeName(42)).toBe('Component');
  });
});

describe('resolveSafePath — путь всегда внутри src/components', () => {
  it('валидное имя', () => {
    const { filePath, name } = resolveSafePath(CWD, 'Button');
    expect(name).toBe('Button');
    expect(filePath).toBe(path.join(ALLOWED, 'Button.tsx'));
  });

  it('traversal нейтрализуется санитизацией — файл остаётся внутри', () => {
    for (const evil of ['../../evil', '/etc/passwd', '..\\..\\windows\\system32', 'a/../../b']) {
      const { filePath } = resolveSafePath(CWD, evil);
      // Главное свойство безопасности: итог строго внутри разрешённого каталога.
      expect(filePath.startsWith(ALLOWED + path.sep)).toBe(true);
    }
  });

  it('имя из одних спецсимволов → Component.tsx внутри каталога', () => {
    const { filePath, name } = resolveSafePath(CWD, '../../../');
    expect(name).toBe('Component');
    expect(filePath).toBe(path.join(ALLOWED, 'Component.tsx'));
  });
});
