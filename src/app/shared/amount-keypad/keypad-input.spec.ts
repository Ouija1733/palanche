import type { KeypadKey } from './keypad-input';
import { applyKeypadKey, centsToKeypadText, formatKeypadText, keypadTextToCents } from './keypad-input';

/** Types a sequence of keys starting from an empty amount. */
function type(keys: string): string {
  return [...keys].reduce((text, key) => applyKeypadKey(text, (key === '<' ? 'backspace' : key) as KeypadKey), '');
}

describe('keypad input', () => {
  it.each([
    ['1250', '1250'],
    ['12,5', '12,5'],
    ['12,50', '12,50'],
    ['12,505', '12,50'], // at most two decimals
    ['12,,5', '12,5'], // a single comma
    [',5', '0,5'], // a leading comma becomes "0,"
    ['0', '0'],
    ['05', '5'], // no leading zeros
    ['0,05', '0,05'],
    ['00', '0'],
    ['1234567890', '123456789'], // at most 9 integer digits
    ['123456789,99', '123456789,99'],
    ['12,5<', '12,'],
    ['12,5<<', '12'],
    ['1<<', ''], // backspace on empty does nothing
  ])('typing "%s" gives "%s"', (keys, expected) => {
    expect(type(keys)).toBe(expected);
  });

  it.each([
    ['', 0],
    ['0', 0],
    ['12', 1200],
    ['12,', 1200],
    ['12,5', 1250],
    ['0,05', 5],
    ['123456789,99', 12345678999],
  ])('"%s" is %i cents', (text, cents) => {
    expect(keypadTextToCents(text)).toBe(cents);
  });

  it.each([
    [1250, '12,50'],
    [1200, '12'],
    [5, '0,05'],
    [0, ''],
  ])('%i cents become "%s"', (cents, text) => {
    expect(centsToKeypadText(cents)).toBe(text);
    expect(keypadTextToCents(text)).toBe(cents);
  });

  it.each([
    ['', '€ 0'],
    ['1234', '€ 1.234'],
    ['1234,', '€ 1.234,'],
    ['1234,5', '€ 1.234,5'],
    ['12,50', '€ 12,50'],
  ])('shows "%s" as "%s"', (text, shown) => {
    expect(formatKeypadText(text)).toBe(shown);
  });
});
