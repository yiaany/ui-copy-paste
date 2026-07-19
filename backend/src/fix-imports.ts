/**
 * Детерминированный пост-процессор импортов (Сессия 8).
 *
 * LLM иногда использует иконку/хук/motion, но забывает импорт — код не компилится.
 * Здесь чистой логикой досматриваем код: что РЕАЛЬНО используется из react,
 * framer-motion и lucide-react, и дописываем недостающие импорты, не трогая уже
 * существующие. Чистая логика без сети/IO — покрыта юнит-тестами.
 */

/** Набор имён, известных как иконки lucide (узнаём по использованию + наличию в импорте). */
const REACT_HOOKS = [
  'useState',
  'useEffect',
  'useRef',
  'useMemo',
  'useCallback',
  'useReducer',
  'useContext',
  'useLayoutEffect',
  'useId',
  'useTransition',
];

const FRAMER_NAMES = ['motion', 'AnimatePresence', 'useAnimation', 'useInView', 'useScroll', 'useMotionValue', 'useTransform'];

/** Парсит уже импортированные именованные символы из модуля `from`. */
function importedFrom(code: string, from: string): Set<string> {
  const out = new Set<string>();
  // import X, { A, B } from 'from'  |  import { A, B } from "from"
  const re = new RegExp(
    `import\\s+(?:[A-Za-z0-9_]+\\s*,\\s*)?\\{([^}]*)\\}\\s*from\\s*['"]${from.replace('/', '\\/')}['"]`,
    'g',
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/)[0].trim();
      if (name) out.add(name);
    }
  }
  return out;
}

/** Имена, используемые как JSX-теги: <Foo ...> или <Foo>. PascalCase. */
function usedJsxComponents(code: string): Set<string> {
  const out = new Set<string>();
  const re = /<([A-Z][A-Za-z0-9]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) out.add(m[1]);
  return out;
}

/** Используется ли идентификатор в коде как слово (хук, motion.* и т.п.). */
function usesIdentifier(code: string, name: string): boolean {
  return new RegExp(`\\b${name}\\b`).test(code);
}

export interface FixImportsResult {
  code: string;
  /** Что дописали (для warnings). */
  added: string[];
}

/**
 * Дописывает недостающие импорты react / framer-motion / lucide-react.
 * lucide-иконки определяем так: PascalCase-JSX-тег, который НЕ объявлен в файле
 * (нет `function Name`/`const Name`) и НЕ импортирован откуда-то ещё, и не motion.
 */
export function fixImports(code: string): FixImportsResult {
  const added: string[] = [];
  const lines: string[] = [];

  // 1) React-хуки.
  const reactImported = importedFrom(code, 'react');
  const missingHooks = REACT_HOOKS.filter(
    (h) => usesIdentifier(code, h) && !reactImported.has(h),
  );

  // 2) framer-motion.
  const framerImported = importedFrom(code, 'framer-motion');
  const usesMotion = /\bmotion\s*\./.test(code) || /<motion\./.test(code);
  const missingFramer = FRAMER_NAMES.filter((n) => {
    if (framerImported.has(n)) return false;
    if (n === 'motion') return usesMotion;
    return usesIdentifier(code, n);
  });

  // 3) lucide-react иконки. Все уже импортированные (откуда угодно) не трогаем.
  const declared = new Set<string>();
  for (const m of code.matchAll(/(?:function|const|class)\s+([A-Z][A-Za-z0-9]*)/g)) {
    declared.add(m[1]);
  }
  const anyImported = new Set<string>();
  for (const m of code.matchAll(/import\s+(?:([A-Za-z0-9_]+)\s*,?\s*)?(?:\{([^}]*)\})?\s*from/g)) {
    if (m[1]) anyImported.add(m[1]);
    if (m[2]) for (const p of m[2].split(',')) {
      const n = p.trim().split(/\s+as\s+/)[0].trim();
      if (n) anyImported.add(n);
    }
  }
  const missingIcons: string[] = [];
  for (const comp of usedJsxComponents(code)) {
    if (comp === 'AnimatePresence' || comp.startsWith('motion')) continue;
    if (declared.has(comp)) continue; // это сам компонент/локальный
    if (anyImported.has(comp)) continue; // уже импортирован
    missingIcons.push(comp);
  }

  // Собираем недостающие импорты.
  if (missingHooks.length > 0) {
    // Если React уже импортирован дефолтно с {..}, лучше дополнить — но проще
    // добавить отдельную строку именованного импорта (React это допускает).
    lines.push(`import { ${missingHooks.join(', ')} } from 'react';`);
    added.push(`react: ${missingHooks.join(', ')}`);
  }
  if (missingFramer.length > 0) {
    lines.push(`import { ${missingFramer.join(', ')} } from 'framer-motion';`);
    added.push(`framer-motion: ${missingFramer.join(', ')}`);
  }
  if (missingIcons.length > 0) {
    lines.push(`import { ${missingIcons.join(', ')} } from 'lucide-react';`);
    added.push(`lucide-react: ${missingIcons.join(', ')}`);
  }

  if (lines.length === 0) return { code, added };

  // Вставляем после последнего существующего импорта (или в начало).
  const importLineRe = /^import\s.*$/gm;
  let lastImportEnd = -1;
  let m: RegExpExecArray | null;
  while ((m = importLineRe.exec(code)) !== null) {
    lastImportEnd = m.index + m[0].length;
  }
  const block = lines.join('\n');
  let next: string;
  if (lastImportEnd >= 0) {
    next = code.slice(0, lastImportEnd) + '\n' + block + code.slice(lastImportEnd);
  } else {
    next = block + '\n' + code;
  }

  return { code: next, added };
}
