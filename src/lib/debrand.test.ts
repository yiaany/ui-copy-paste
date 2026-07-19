import { describe, it, expect } from 'vitest';
import { debrand, loremOfLength } from './debrand.ts';
import type { ExtractedNode, DebrandOptions } from './types.ts';

const RECT = { x: 0, y: 0, width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0 };
const ALL: DebrandOptions = {
  stripImages: true,
  stripLogos: true,
  loremText: true,
  neutralizePalette: true,
};

function node(p: Partial<ExtractedNode> & { tag: string }): ExtractedNode {
  return {
    textContent: null,
    attrs: {},
    styles: {},
    rect: RECT,
    children: [],
    isObfuscated: false,
    ...p,
  };
}

describe('loremOfLength', () => {
  it('генерит текст примерно той же длины', () => {
    const orig = 'Купите наш лучший продукт сегодня';
    const out = loremOfLength(orig);
    expect(Math.abs(out.length - orig.length)).toBeLessThanOrEqual(8);
  });
  it('пустой → пустой', () => {
    expect(loremOfLength('')).toBe('');
  });
});

describe('debrand — картинки', () => {
  it('<img> → плейсхолдер с подписью размера', () => {
    const img = node({
      tag: 'img',
      attrs: { src: 'https://brand.com/photo.jpg', alt: 'фото' },
      rect: { ...RECT, width: 320, height: 200 },
    });
    const out = debrand(img, ALL);
    expect(out.tag).toBe('div');
    expect(out.attrs['data-placeholder']).toBe('image');
    expect(out.textContent).toContain('320');
    expect(out.textContent).toContain('200');
    expect(out.attrs.src).toBeUndefined();
  });

  it('фоновая картинка → background-image:none', () => {
    const div = node({
      tag: 'div',
      styles: { 'background-image': 'url(https://brand.com/bg.png)' },
    });
    const out = debrand(div, ALL);
    expect(out.styles['background-image']).toBe('none');
  });

  it('stripImages=false — картинку не трогаем', () => {
    const img = node({ tag: 'img', attrs: { src: 'x.jpg' } });
    const out = debrand(img, { ...ALL, stripImages: false });
    expect(out.tag).toBe('img');
  });
});

describe('debrand — логотипы', () => {
  it('svg в header → дженерик-логотип', () => {
    const tree = node({
      tag: 'header',
      children: [node({ tag: 'svg', svgMarkup: '<svg><path d="brand"/></svg>' })],
    });
    const out = debrand(tree, ALL);
    expect(out.children[0].attrs['data-placeholder']).toBe('logo');
    expect(out.children[0].svgMarkup).toContain('generic-logo');
  });

  it('alt~logo → дженерик', () => {
    const el = node({ tag: 'img', attrs: { alt: 'Company Logo' } });
    const out = debrand(el, ALL);
    expect(out.attrs['data-placeholder']).toBe('logo');
  });

  it('обычный svg вне header — не логотип', () => {
    const el = node({ tag: 'svg', svgMarkup: '<svg/>' });
    const out = debrand(el, ALL);
    expect(out.attrs['data-placeholder']).not.toBe('logo');
  });
});

describe('debrand — текст', () => {
  it('заголовок → "Heading"', () => {
    const out = debrand(node({ tag: 'h1', textContent: 'Секретный слоган' }), ALL);
    expect(out.textContent).toBe('Heading');
  });
  it('кнопка → "Call to action"', () => {
    const out = debrand(node({ tag: 'button', textContent: 'Купить сейчас' }), ALL);
    expect(out.textContent).toBe('Call to action');
  });
  it('цена → "$ —"', () => {
    const out = debrand(node({ tag: 'span', textContent: '$1,299' }), ALL);
    expect(out.textContent).toBe('$ —');
  });
  it('обычный текст → lorem той же длины', () => {
    const orig = 'Проприетарное описание продукта';
    const out = debrand(node({ tag: 'p', textContent: orig }), ALL);
    expect(out.textContent).not.toBe(orig);
    expect(out.textContent!.length).toBeGreaterThan(0);
  });
  it('loremText=false — текст сохраняется', () => {
    const out = debrand(node({ tag: 'p', textContent: 'Оригинал' }), {
      ...ALL,
      loremText: false,
    });
    expect(out.textContent).toBe('Оригинал');
  });
});

describe('debrand — палитра', () => {
  it('neutralizePalette мапит цвет в slate', () => {
    const out = debrand(
      node({ tag: 'div', styles: { 'background-color': 'rgb(220, 20, 60)' } }),
      ALL,
    );
    expect(out.styles['background-color']).not.toBe('rgb(220, 20, 60)');
    expect(out.styles['background-color']).toMatch(/rgb/);
  });
  it('neutralizePalette=false — цвет сохраняется', () => {
    const out = debrand(
      node({ tag: 'div', styles: { color: 'rgb(220, 20, 60)' } }),
      { ...ALL, neutralizePalette: false },
    );
    expect(out.styles.color).toBe('rgb(220, 20, 60)');
  });
});

describe('debrand — рекурсия и иммутабельность', () => {
  it('обходит дерево и не мутирует оригинал', () => {
    const orig = node({
      tag: 'section',
      children: [node({ tag: 'h2', textContent: 'Заголовок секции' })],
    });
    const out = debrand(orig, ALL);
    expect(out.children[0].textContent).toBe('Heading');
    expect(orig.children[0].textContent).toBe('Заголовок секции'); // не мутирован
  });
});
