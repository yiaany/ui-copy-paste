import { describe, it, expect } from 'vitest';
import { detectSensitivePage } from './safety.ts';
import type { ExtractedNode } from './schema.ts';

const RECT = { x: 0, y: 0, width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0 };

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

const input = (attrs: Record<string, string>) => node({ tag: 'input', attrs });

describe('detectSensitivePage — блокирует', () => {
  it('платёжную форму (поле карты + платёжная лексика)', () => {
    const tree = node({
      tag: 'form',
      children: [
        node({ tag: 'label', textContent: 'Номер карты' }),
        input({ name: 'card-number', placeholder: 'Card number' }),
        input({ name: 'cvv', placeholder: 'CVV' }),
        node({ tag: 'button', textContent: 'Оплатить' }),
      ],
    });
    expect(detectSensitivePage(tree).blocked).toBe(true);
  });

  it('логин банка (пароль + вход + банк-лексика)', () => {
    const tree = node({
      tag: 'form',
      children: [
        node({ tag: 'h1', textContent: 'Вход в Сбербанк Онлайн' }),
        input({ type: 'text', name: 'login' }),
        input({ type: 'password', name: 'password' }),
        node({ tag: 'button', textContent: 'Войти' }),
      ],
    });
    expect(detectSensitivePage(tree).blocked).toBe(true);
  });

  it('усиливается доменом в url', () => {
    const tree = node({
      tag: 'form',
      children: [input({ type: 'password' }), node({ tag: 'span', textContent: 'login' })],
    });
    expect(detectSensitivePage(tree, 'https://paypal.com/signin').blocked).toBe(true);
  });
});

describe('detectSensitivePage — НЕ блокирует (без ложных срабатываний)', () => {
  it('обычную форму логина без банк-лексики (напр. SaaS)', () => {
    const tree = node({
      tag: 'form',
      children: [
        node({ tag: 'h1', textContent: 'Sign in to Acme Dashboard' }),
        input({ type: 'email', name: 'email' }),
        input({ type: 'password', name: 'password' }),
        node({ tag: 'button', textContent: 'Log in' }),
      ],
    });
    // пароль+логин есть, но платёжной лексики нет → не блок
    expect(detectSensitivePage(tree).blocked).toBe(false);
  });

  it('лендинг со словом "bank" в тексте, но без полей', () => {
    const tree = node({
      tag: 'section',
      children: [node({ tag: 'p', textContent: 'We work with every major bank.' })],
    });
    expect(detectSensitivePage(tree).blocked).toBe(false);
  });

  it('карточка товара с ценой', () => {
    const tree = node({
      tag: 'div',
      children: [
        node({ tag: 'h3', textContent: 'Product' }),
        node({ tag: 'span', textContent: '$49' }),
        node({ tag: 'button', textContent: 'Add to cart' }),
      ],
    });
    expect(detectSensitivePage(tree).blocked).toBe(false);
  });

  it('undefined-дерево (screenshot-режим) — не блок', () => {
    expect(detectSensitivePage(undefined).blocked).toBe(false);
  });
});
