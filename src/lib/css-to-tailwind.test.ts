import { describe, it, expect } from 'vitest';
import { cssToTailwind, toHexArbitrary } from './css-to-tailwind.ts';
import { spacing } from './tailwind-map.ts';

describe('spacing', () => {
  it('мапит px на токены Tailwind-шкалы', () => {
    expect(spacing(0)).toBe('0');
    expect(spacing(16)).toBe('4');
    expect(spacing(24)).toBe('6');
    expect(spacing(64)).toBe('16');
  });

  it('нестандартный px → произвольное значение', () => {
    expect(spacing(13)).toBe('[13px]');
    expect(spacing(7)).toBe('[7px]');
  });
});

describe('toHexArbitrary', () => {
  it('rgb → [#hex]', () => {
    expect(toHexArbitrary('rgb(99, 102, 241)')).toBe('[#6366f1]');
    expect(toHexArbitrary('rgb(255, 255, 255)')).toBe('[#ffffff]');
    expect(toHexArbitrary('rgb(0, 0, 0)')).toBe('[#000000]');
  });

  it('rgba с альфой сохраняется без потерь', () => {
    expect(toHexArbitrary('rgba(99, 102, 241, 0.5)')).toBe('[rgba(99,102,241,0.5)]');
  });
});

describe('cssToTailwind — spacing', () => {
  it('padding/margin/gap по шкале', () => {
    const out = cssToTailwind({
      'padding-top': '16px',
      'padding-left': '8px',
      'margin-bottom': '24px',
      gap: '12px',
    });
    expect(out).toContain('pt-4');
    expect(out).toContain('pl-2');
    expect(out).toContain('mb-6');
    expect(out).toContain('gap-3');
  });

  it('нестандартный отступ → произвольное значение', () => {
    expect(cssToTailwind({ 'padding-top': '13px' })).toContain('pt-[13px]');
  });

  it('отрицательный margin', () => {
    expect(cssToTailwind({ 'margin-top': '-16px' })).toContain('-mt-4');
  });
});

describe('cssToTailwind — цвета', () => {
  it('color → text-[#hex], background → bg-[#hex]', () => {
    const out = cssToTailwind({
      color: 'rgb(99, 102, 241)',
      'background-color': 'rgb(255, 255, 255)',
    });
    expect(out).toContain('text-[#6366f1]');
    expect(out).toContain('bg-[#ffffff]');
  });

  it('прозрачный фон → bg-transparent', () => {
    expect(cssToTailwind({ 'background-color': 'rgba(0,0,0,0)' })).toContain(
      'bg-transparent',
    );
  });
});

describe('cssToTailwind — радиусы и шрифт', () => {
  it('border-radius по шкале', () => {
    expect(cssToTailwind({ 'border-radius': '8px' })).toContain('rounded-lg');
    expect(cssToTailwind({ 'border-radius': '4px' })).toContain('rounded');
    expect(cssToTailwind({ 'border-radius': '9999px' })).toContain('rounded-full');
  });

  it('font-size по порогам', () => {
    expect(cssToTailwind({ 'font-size': '12px' })).toContain('text-xs');
    expect(cssToTailwind({ 'font-size': '16px' })).toContain('text-base');
    expect(cssToTailwind({ 'font-size': '24px' })).toContain('text-2xl');
  });

  it('font-weight через DIRECT', () => {
    expect(cssToTailwind({ 'font-weight': '700' })).toContain('font-bold');
    expect(cssToTailwind({ 'font-weight': '500' })).toContain('font-medium');
  });
});

describe('cssToTailwind — box-shadow', () => {
  it('тень → shadow-* по силе', () => {
    expect(cssToTailwind({ 'box-shadow': '0 1px 2px rgba(0,0,0,0.1)' })).toContain(
      'shadow-sm',
    );
    const big = cssToTailwind({ 'box-shadow': '0 20px 25px rgba(0,0,0,0.2)' });
    expect(big.some((c) => c.startsWith('shadow'))).toBe(true);
  });
});

describe('cssToTailwind — DIRECT', () => {
  it('display/flex/justify/align/position', () => {
    const out = cssToTailwind({
      display: 'flex',
      'flex-direction': 'column',
      'justify-content': 'space-between',
      'align-items': 'center',
      position: 'absolute',
    });
    expect(out).toEqual(
      expect.arrayContaining([
        'flex',
        'flex-col',
        'justify-between',
        'items-center',
        'absolute',
      ]),
    );
  });
});

describe('cssToTailwind — фолбэк и дедуп', () => {
  it('неузнанное свойство → [prop:value]', () => {
    const out = cssToTailwind({ 'backdrop-filter': 'blur(4px)' });
    expect(out).toContain('[backdrop-filter:blur(4px)]');
  });

  it('дублирующиеся классы убираются', () => {
    const out = cssToTailwind({
      'border-top-left-radius': '8px',
      'border-top-right-radius': '8px',
      'border-bottom-left-radius': '8px',
      'border-bottom-right-radius': '8px',
    });
    expect(out.filter((c) => c === 'rounded-lg')).toHaveLength(1);
  });

  it('пустые значения игнорируются', () => {
    expect(cssToTailwind({ color: '' })).toHaveLength(0);
  });
});
