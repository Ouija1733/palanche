import { parseAmountToCents } from '../../core/utils/money';

/** Keys of the amount keypad. */
export type KeypadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | ',' | 'backspace';

/** Up to € 999.999.999,99: plenty for a personal budget, and always a safe integer. */
export const MAX_INTEGER_DIGITS = 9;

const integerFormat = new Intl.NumberFormat('it-IT', { useGrouping: 'always', maximumFractionDigits: 0 });

/**
 * Applies a key to the text typed so far ("12,5"). The text is always a
 * valid partial amount: digits, at most one comma, at most two decimals, no
 * leading zeros. Keys that would break these rules are ignored.
 */
export function applyKeypadKey(text: string, key: KeypadKey): string {
  if (key === 'backspace') {
    return text.slice(0, -1);
  }
  const [integer, decimals] = text.split(',');
  if (key === ',') {
    if (decimals !== undefined) {
      return text;
    }
    return text === '' ? '0,' : `${text},`;
  }
  if (decimals !== undefined) {
    return decimals.length < 2 ? text + key : text;
  }
  if (integer === '0') {
    return key;
  }
  if (integer.length >= MAX_INTEGER_DIGITS) {
    return text;
  }
  return text + key;
}

/** Cents of the typed text; 0 while nothing has been typed. */
export function keypadTextToCents(text: string): number {
  return text === '' ? 0 : parseAmountToCents(text);
}

/** Text for the keypad from existing cents (editing a transaction): 1250 → "12,50", 1200 → "12". */
export function centsToKeypadText(cents: number): string {
  if (cents <= 0) {
    return '';
  }
  const units = Math.trunc(cents / 100);
  const fraction = cents % 100;
  return fraction === 0 ? String(units) : `${units},${String(fraction).padStart(2, '0')}`;
}

/** The typed text as shown above the keypad: "1234,5" → "€ 1.234,5". */
export function formatKeypadText(text: string): string {
  const [integer, decimals] = text.split(',');
  const grouped = integerFormat.format(Number(integer || '0'));
  return `€\u00A0${grouped}${decimals === undefined ? '' : `,${decimals}`}`;
}
