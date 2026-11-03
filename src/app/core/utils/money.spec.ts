import { formatCents, formatTransactionAmount, parseAmountToCents } from './money';

// Expected strings use a non-breaking space (U+00A0) and the minus sign (U+2212).
const S = ' ';
const M = '−';

describe('money', () => {
  describe('formatCents', () => {
    it('formats with the euro symbol first and Italian separators', () => {
      expect(formatCents(123456)).toBe(`€${S}1.234,56`);
    });

    it('groups thousands also for four-digit amounts', () => {
      expect(formatCents(210430)).toBe(`€${S}2.104,30`);
    });

    it('always shows two decimals', () => {
      expect(formatCents(1250)).toBe(`€${S}12,50`);
      expect(formatCents(5)).toBe(`€${S}0,05`);
      expect(formatCents(0)).toBe(`€${S}0,00`);
    });

    it('formats large amounts exactly', () => {
      expect(formatCents(123456789)).toBe(`€${S}1.234.567,89`);
    });

    it('prefixes negative amounts with the minus sign', () => {
      expect(formatCents(-1200)).toBe(`${M}€${S}12,00`);
    });

    it('rejects non-integer cents', () => {
      expect(() => formatCents(12.5)).toThrow(RangeError);
      expect(() => formatCents(Number.NaN)).toThrow(RangeError);
    });
  });

  describe('formatTransactionAmount', () => {
    it('prefixes expenses with the minus sign', () => {
      expect(formatTransactionAmount(3820, 'expense')).toBe(`${M}${S}€${S}38,20`);
    });

    it('prefixes income with a plus sign', () => {
      expect(formatTransactionAmount(150000, 'income')).toBe(`+${S}€${S}1.500,00`);
    });

    it('leaves transfers neutral', () => {
      expect(formatTransactionAmount(20000, 'transfer')).toBe(`€${S}200,00`);
    });

    it('rejects negative amounts', () => {
      expect(() => formatTransactionAmount(-100, 'expense')).toThrow(RangeError);
    });
  });

  describe('parseAmountToCents', () => {
    it.each([
      ['12', 1200],
      ['12,5', 1250],
      ['12,50', 1250],
      ['12,', 1200],
      ['0,05', 5],
      ['1234,56', 123456],
      ['1.234,56', 123456],
      ['1.234.567', 123456700],
      ['€ 38,20', 3820],
      [' 7,1 ', 710],
    ])('parses "%s" as %i cents', (input, expected) => {
      expect(parseAmountToCents(input)).toBe(expected);
    });

    it('does not suffer from floating-point errors', () => {
      // 0.29 * 100 = 28.999999999999996 in floating point
      expect(parseAmountToCents('0,29')).toBe(29);
      expect(parseAmountToCents('1,15')).toBe(115);
    });

    it.each(['', 'abc', '12,345', '-5', '12.50', '1.23,45', '1,2,3', ',50'])('rejects "%s"', (input) => {
      expect(() => parseAmountToCents(input)).toThrow();
    });

    it('round-trips with formatCents', () => {
      for (const cents of [0, 1, 99, 100, 123456, 987654321]) {
        expect(parseAmountToCents(formatCents(cents))).toBe(cents);
      }
    });
  });
});
