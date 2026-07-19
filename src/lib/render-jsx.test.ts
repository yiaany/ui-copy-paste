import { describe, it, expect } from 'vitest';
import { renderJsx, renderInlineHtml } from './render-jsx.ts';
import type { ExtractedNode } from './types.ts';

const RECT = { x: 0, y: 0, width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0 };

function node(partial: Partial<ExtractedNode> & { tag: string }): ExtractedNode {
  return {
    textContent: null,
    attrs: {},
    styles: {},
    rect: RECT,
    children: [],
    isObfuscated: false,
    ...partial,
  };
}

describe('renderJsx', () => {
  it('кнопка с классами и текстом', () => {
    const { code, componentName } = renderJsx(
      node({
        tag: 'button',
        textContent: 'Купить',
        attrs: { type: 'submit' },
        styles: { display: 'flex', 'padding-top': '16px' },
      }),
    );
    expect(componentName).toBe('ButtonPreview');
    expect(code).toContain('<button');
    expect(code).toContain('className="flex pt-4"');
    expect(code).toContain('type="submit"');
    expect(code).toContain('Купить');
    expect(code).toContain('</button>');
  });

  it('рекурсивно рендерит детей', () => {
    const { code } = renderJsx(
      node({
        tag: 'div',
        children: [node({ tag: 'span', textContent: 'hi' })],
      }),
    );
    expect(code).toContain('<div');
    expect(code).toContain('<span>hi</span>');
  });

  it('svg → комментарий-плейсхолдер', () => {
    const { code } = renderJsx(
      node({ tag: 'svg', svgMarkup: '<svg><path/></svg>' }),
    );
    expect(code).toContain('lucide-react');
    expect(code).not.toContain('<path');
  });

  it('void-элемент самозакрывается, for→htmlFor', () => {
    const { code } = renderJsx(
      node({
        tag: 'div',
        children: [
          node({ tag: 'label', attrs: { for: 'e' }, textContent: 'Email' }),
          node({ tag: 'input', attrs: { type: 'email' } }),
        ],
      }),
    );
    expect(code).toContain('htmlFor="e"');
    expect(code).toMatch(/<input[^>]*\/>/);
  });
});

describe('renderInlineHtml', () => {
  it('инлайн-стили из styles, текст внутри', () => {
    const html = renderInlineHtml(
      node({ tag: 'div', textContent: 'X', styles: { color: 'rgb(1,2,3)' } }),
    );
    expect(html).toContain('style="color:rgb(1,2,3)"');
    expect(html).toContain('>X<');
  });

  it('svg вставляется как svgMarkup', () => {
    const html = renderInlineHtml(node({ tag: 'svg', svgMarkup: '<svg id="i"/>' }));
    expect(html).toBe('<svg id="i"/>');
  });
});
