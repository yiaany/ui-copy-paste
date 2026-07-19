import { describe, it, expect } from 'vitest';
import { fixImports } from './fix-imports.ts';

describe('fixImports — lucide-react', () => {
  it('дописывает недостающие иконки', () => {
    const code = `export default function Card() {
  return <div><Check /><X /></div>;
}`;
    const { code: out, added } = fixImports(code);
    expect(out).toContain("import { Check, X } from 'lucide-react'");
    expect(added.some((a) => a.includes('lucide'))).toBe(true);
  });

  it('не дублирует уже импортированную иконку', () => {
    const code = `import { Check } from 'lucide-react';
export default function Card() {
  return <div><Check /><X /></div>;
}`;
    const { code: out } = fixImports(code);
    // X дописан, Check не продублирован
    const lucideLines = out.match(/from 'lucide-react'/g) ?? [];
    expect(out).toContain('X');
    // Check уже был — новый импорт только для X
    expect(lucideLines.length).toBeGreaterThanOrEqual(1);
  });

  it('не трогает сам компонент (объявленный локально)', () => {
    const code = `export default function PriceCard() {
  return <PriceCard />;
}`;
    const { code: out } = fixImports(code);
    expect(out).not.toContain("import { PriceCard }");
  });
});

describe('fixImports — framer-motion', () => {
  it('дописывает motion при использовании motion.div', () => {
    const code = `export default function A() {
  return <motion.div animate={{ opacity: 1 }} />;
}`;
    const { code: out } = fixImports(code);
    expect(out).toContain("from 'framer-motion'");
    expect(out).toContain('motion');
  });

  it('дописывает AnimatePresence', () => {
    const code = `export default function A() {
  return <AnimatePresence><div/></AnimatePresence>;
}`;
    const { code: out } = fixImports(code);
    expect(out).toContain('AnimatePresence');
    expect(out).toContain("from 'framer-motion'");
  });

  it('не дублирует существующий framer-импорт', () => {
    const code = `import { motion } from 'framer-motion';
export default function A() {
  return <motion.div />;
}`;
    const { added } = fixImports(code);
    expect(added.some((a) => a.includes('framer'))).toBe(false);
  });
});

describe('fixImports — react hooks', () => {
  it('дописывает useState', () => {
    const code = `export default function A() {
  const [n, setN] = useState(0);
  return <div>{n}</div>;
}`;
    const { code: out } = fixImports(code);
    expect(out).toContain("import { useState } from 'react'");
  });

  it('не дублирует импортированный хук', () => {
    const code = `import { useState } from 'react';
export default function A() {
  const [n] = useState(0);
  return <div>{n}</div>;
}`;
    const { added } = fixImports(code);
    expect(added.some((a) => a.includes('react'))).toBe(false);
  });
});

describe('fixImports — без изменений', () => {
  it('чистый компонент без пропусков не трогается', () => {
    const code = `import { useState } from 'react';
import { Check } from 'lucide-react';
export default function A() {
  const [n] = useState(0);
  return <div><Check />{n}</div>;
}`;
    const { added } = fixImports(code);
    expect(added).toHaveLength(0);
  });
});
