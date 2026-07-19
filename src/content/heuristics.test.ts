// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { chooseMode, analyzeMode } from './heuristics.ts';

function mount(html: string): Element {
  document.body.innerHTML = html;
  const el = document.body.firstElementChild;
  if (!el) throw new Error('фикстура пуста');
  return el;
}

describe('chooseMode', () => {
  it('чистое дерево с читаемыми классами → dom', () => {
    const el = mount(
      '<div class="card"><h2 class="title">Hi</h2><p class="text">body</p><button class="btn">Ok</button></div>',
    );
    expect(chooseMode(el)).toBe('dom');
  });

  it('дерево с >40% хеш-классов → screenshot', () => {
    const el = mount(
      '<div class="css-1a2b3c"><span class="sc-9z8y7x">a</span><span class="jsx-1234567">b</span><span class="emotion-7h6g5f">c</span></div>',
    );
    const decision = analyzeMode(el);
    expect(decision.obfuscatedRatio).toBeGreaterThan(0.4);
    expect(decision.mode).toBe('screenshot');
  });

  it('наличие canvas форсирует screenshot даже в читаемом дереве', () => {
    const el = mount('<div class="wrap"><canvas></canvas></div>');
    const decision = analyzeMode(el);
    expect(decision.hasCanvas).toBe(true);
    expect(decision.mode).toBe('screenshot');
  });

  it('analyzeMode считает количество узлов поддерева', () => {
    const el = mount('<div><span>a</span><span>b</span></div>');
    expect(analyzeMode(el).total).toBe(3);
  });
});
