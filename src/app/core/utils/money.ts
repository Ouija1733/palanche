import type { TransactionType } from '../models/transaction-type';

/**
 * Money helpers. Amounts are always integer cents: this file is the only place
 * that converts them to and from human-readable text.
 */

/** Non-breaking space, so "€ 12,50" never wraps across two lines. */
const NBSP = ' ';
/** Typographic minus sign (U+2212), wider and more readable than a hyphen. */
export const MINUS_SIGN = '−';

// The Italian locale writes "1234,56 €": it puts the symbol after the number and
// skips the thousands separator for four-digit amounts. The app shows "€ 1.234,56",
// so we format only the number (always grouped) and add the symbol ourselves.
const numberFormat = new Intl.NumberFormat('it-IT', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: 'always',
});

function assertCents(cents: number): void {
  if (!Number.isSafeInteger(cents)) {
    throw new RangeError(`Amount must be an integer number of cents, got ${cents}`);
  }
}

/** Formats an absolute amount as "€ 1.234,56" (always positive). */
function formatAbsolute(cents: number): string {
  const abs = Math.abs(cents);
  const units = Math.trunc(abs / 100);
  const fraction = String(abs % 100).padStart(2, '0');
  // Passing an exact decimal string avoids any floating-point rounding.
  return `€${NBSP}${numberFormat.format(`${units}.${fraction}` as Intl.StringNumericLiteral)}`;
}

/**
 * Formats integer cents as "€ 1.234,56". Negative values (e.g. a negative
 * balance) get the "−" prefix: "−€ 12,00".
 */
export function formatCents(cents: number): string {
  assertCents(cents);
  return cents < 0 ? `${MINUS_SIGN}${formatAbsolute(cents)}` : formatAbsolute(cents);
}

/**
 * Formats a transaction amount with the sign given by its type:
 * expense "− € 38,20", income "+ € 1.500,00", transfer "€ 200,00" (neutral).
 */
export function formatTransactionAmount(cents: number, type: TransactionType): string {
  assertCents(cents);
  if (cents < 0) {
    throw new RangeError(`Transaction amounts must be positive, got ${cents}`);
  }
  const amount = formatAbsolute(cents);
  switch (type) {
    case 'expense':
      return `${MINUS_SIGN}${NBSP}${amount}`;
    case 'income':
      return `+${NBSP}${amount}`;
    case 'transfer':
      return amount;
  }
}

// Either plain digits ("1234") or digits grouped by dots ("1.234"),
// optionally followed by a comma and up to two decimals.
const AMOUNT_PATTERN = /^(\d+|\d{1,3}(?:\.\d{3})+)(?:,(\d{0,2}))?$/;

/**
 * Parses an amount typed in Italian format into integer cents:
 * "12" → 1200, "12,5" → 1250, "1.234,56" → 123456. An optional "€" and spaces
 * are ignored. Throws on anything else (negative numbers, three decimals,
 * a dot used as the decimal separator…).
 *
 * The parsing works on the text, never on floating-point numbers.
 */
export function parseAmountToCents(input: string): number {
  const text = input.replace(/€/g, '').replace(/\s/g, '');
  const match = AMOUNT_PATTERN.exec(text);
  if (!match) {
    throw new Error(`Invalid amount: "${input}"`);
  }
  const units = match[1].replace(/\./g, '');
  const fraction = (match[2] ?? '').padEnd(2, '0');
  const cents = Number(units) * 100 + Number(fraction);
  if (!Number.isSafeInteger(cents)) {
    throw new RangeError(`Amount too large: "${input}"`);
  }
  return cents;
}
