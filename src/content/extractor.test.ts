// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { extract, isObfuscated } from './extractor.ts';

/**
 * Тесты экстрактора (jsdom). jsdom не делает layout, поэтому rect нулевой и
 * getComputedStyle отдаёт немного — проверяем структуру, текст, атрибуты,
 * фильтрацию мусора, svg и обфускацию (то, что не зависит от реального лейаута).
 */
function mount(html: string): Element {
  document.body.innerHTML = html;
  const el = document.body.firstElementChild;
  if (!el) throw new Error('фикстура пуста');
  return el;
}

describe('extract — базовая структура', () => {
  it('кнопка: тег, прямой текст, осмысленные атрибуты; class/style/id выкинуты', () => {
    const el = mount(
      '<button type="submit" class="btn css-1a2b3c" id="go" data-x="junk" data-testid="submit" aria-label="Отправить" style="color:red">Купить</button>',
    );
    const node = extract(el);

    expect(node.tag).toBe('button');
    expect(node.textContent).toBe('Купить');
    expect(node.attrs.type).toBe('submit');
    expect(node.attrs['aria-label']).toBe('Отправить');
    expect(node.attrs['data-testid']).toBe('submit');
    // мусор отброшен
    expect(node.attrs.class).toBeUndefined();
    expect(node.attrs.style).toBeUndefined();
    expect(node.attrs.id).toBeUndefined();
    expect(node.attrs['data-x']).toBeUndefined();
  });

  it('форма: рекурсивно извлекает детей в порядке документа', () => {
    const el = mount(
      '<form><label for="e">Email</label><input type="email" placeholder="you@x.com" name="email"></form>',
    );
    const node = extract(el);

    expect(node.tag).toBe('form');
    expect(node.children).toHaveLength(2);
    expect(node.children[0].tag).toBe('label');
    expect(node.children[0].attrs.for).toBe('e');
    expect(node.children[1].tag).toBe('input');
    expect(node.children[1].attrs.type).toBe('email');
    expect(node.children[1].attrs.placeholder).toBe('you@x.com');
  });

  it('карточка: прямой текст узла не включает текст потомков', () => {
    const el = mount('<div class="card">Заголовок<p>Описание</p></div>');
    const node = extract(el);

    expect(node.textContent).toBe('Заголовок');
    expect(node.children).toHaveLength(1);
    expect(node.children[0].textContent).toBe('Описание');
  });

  it('стилей немного и они осмысленные (не 300 свойств браузерного шума)', () => {
    const el = mount('<div>x</div>');
    const node = extract(el);
    // Для голого div, совпадающего с дефолтом, шумовых стилей быть почти не должно.
    expect(Object.keys(node.styles).length).toBeLessThan(20);
  });
});

describe('extract — svg', () => {
  it('кладёт outerHTML в svgMarkup и не лезет внутрь', () => {
    const el = mount(
      '<svg viewBox="0 0 24 24"><path d="M0 0h24v24H0z"></path></svg>',
    );
    const node = extract(el);

    expect(node.tag).toBe('svg');
    expect(node.svgMarkup).toContain('<path');
    expect(node.children).toHaveLength(0);
  });
});

describe('extract — глубина', () => {
  it('не уходит глубже maxDepth', () => {
    const el = mount(
      '<div><div><div><div>глубоко</div></div></div></div>',
    );
    const node = extract(el, 0, 2);
    // depth 0 → 1 → 2 (stop): дети есть на 0 и 1, на узле глубины 2 — нет.
    expect(node.children[0].children[0].children).toHaveLength(0);
  });
});

describe('isObfuscated', () => {
  it('canvas всегда обфусцирован', () => {
    expect(isObfuscated(mount('<canvas></canvas>'))).toBe(true);
  });

  it('читаемые классы — не обфусцированы', () => {
    expect(isObfuscated(mount('<div class="card header primary"></div>'))).toBe(
      false,
    );
  });

  it('>60% хеш-классов (emotion/styled) — обфусцирован', () => {
    expect(
      isObfuscated(mount('<div class="css-1q2w3e sc-9f8e7d jsx-1234567"></div>')),
    ).toBe(true);
  });

  it('элемент без классов — не обфусцирован', () => {
    expect(isObfuscated(mount('<section></section>'))).toBe(false);
  });
});
