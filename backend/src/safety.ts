/**
 * Этический/правовой фильтр (Сессия 10, доктрина 6).
 *
 * Pixel-perfect клон страницы логина банка/платёжной системы = вектор фишинга.
 * Детектируем такие страницы по сигналам (поле пароля + банк/платёж-лексика) и
 * отказываем в генерации. Чистая логика над ExtractedNode — без сети/DOM,
 * полностью тестируется. Лучше ложно отказать в спорном случае, чем выпустить
 * инструмент клонирования платёжных форм.
 */
import type { ExtractedNode } from './schema.ts';

/** Лексика банков/платёжных систем (рус+англ). */
const PAYMENT_KEYWORDS = [
  'bank',
  'банк',
  'paypal',
  'stripe',
  'visa',
  'mastercard',
  'мир',
  'sberbank',
  'сбербанк',
  'тинькофф',
  'tinkoff',
  'альфа-банк',
  'alfabank',
  'втб',
  'vtb',
  'card number',
  'номер карты',
  'cvv',
  'cvc',
  'card holder',
  'expiry',
  'срок действия',
  'payment',
  'оплата',
  'платёж',
  'платеж',
  'checkout',
  'billing',
  'wallet',
  'кошелёк',
  'iban',
  'swift',
  'account number',
  'номер счёта',
];

/** Слова-индикаторы формы входа. */
const LOGIN_KEYWORDS = [
  'login',
  'sign in',
  'signin',
  'log in',
  'вход',
  'войти',
  'авторизац',
  'password',
  'пароль',
];

export interface SafetyVerdict {
  blocked: boolean;
  reason?: string;
}

/** Собирает весь текст + значимые атрибуты узла в одну строку (lowercase). */
function harvestText(node: ExtractedNode, acc: string[]): void {
  if (node.textContent) acc.push(node.textContent.toLowerCase());
  for (const v of Object.values(node.attrs)) acc.push(v.toLowerCase());
  for (const c of node.children) harvestText(c, acc);
}

/** Есть ли в дереве поле ввода пароля. */
function hasPasswordField(node: ExtractedNode): boolean {
  if (node.tag === 'input' && node.attrs.type === 'password') return true;
  return node.children.some(hasPasswordField);
}

/** Есть ли поле для номера карты (по type/name/placeholder/autocomplete). */
function hasCardField(node: ExtractedNode): boolean {
  if (node.tag === 'input') {
    const hay = [
      node.attrs.name,
      node.attrs.placeholder,
      node.attrs.autocomplete,
      node.attrs['aria-label'],
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (/card|карт|cvv|cvc|iban|cc-number/.test(hay)) return true;
  }
  return node.children.some(hasCardField);
}

function countMatches(haystack: string, words: string[]): number {
  let n = 0;
  for (const w of words) if (haystack.includes(w)) n += 1;
  return n;
}

/**
 * Решает, блокировать ли генерацию (доктрина 6).
 * Блок, если: (пароль ИЛИ поле карты) И есть платёжная/банковская лексика —
 * это и есть страница логина/оплаты, клонировать которую = фишинг-риск.
 * Опциональный url усиливает сигнал.
 */
export function detectSensitivePage(
  node: ExtractedNode | undefined,
  url?: string,
): SafetyVerdict {
  if (!node) return { blocked: false };

  const parts: string[] = [];
  harvestText(node, parts);
  if (url) parts.push(url.toLowerCase());
  const hay = parts.join(' ');

  const password = hasPasswordField(node);
  const card = hasCardField(node);
  const paymentHits = countMatches(hay, PAYMENT_KEYWORDS);
  const loginHits = countMatches(hay, LOGIN_KEYWORDS);

  // Платёжная форма: поле карты + платёжная лексика → блок.
  if (card && paymentHits >= 1) {
    return {
      blocked: true,
      reason:
        'Похоже на платёжную форму (ввод данных карты). UI Copy-Paste — инструмент для обучения и прототипирования, а не для клонирования платёжных/банковских страниц.',
    };
  }

  // Логин-форма банка/платёжки: пароль + (вход-лексика и платёжная лексика).
  if (password && loginHits >= 1 && paymentHits >= 1) {
    return {
      blocked: true,
      reason:
        'Похоже на страницу входа банка/платёжной системы. Копирование таких страниц несёт риск фишинга и заблокировано. Инструмент предназначен для обучения и прототипирования.',
    };
  }

  return { blocked: false };
}
