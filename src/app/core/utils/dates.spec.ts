import {
  accountingMonthOf,
  accountingPeriod,
  accountingPeriodLength,
  addDays,
  addMonths,
  currentAccountingMonth,
  daysBetween,
  daysInMonth,
  isValidIsoDate,
  isValidMonthStartDay,
  monthBounds,
  monthsBetween,
  nowIso,
  parseIsoDate,
  toIsoDate,
  today,
  toYearMonth,
} from './dates';

describe('dates', () => {
  describe('toIsoDate / today', () => {
    it('uses local components, not UTC', () => {
      // 00:30 local time on 3 November: in UTC (Italy) it would still be 2 November.
      const justAfterMidnight = new Date(2026, 10, 3, 0, 30);
      expect(toIsoDate(justAfterMidnight)).toBe('2026-11-03');
      expect(today(justAfterMidnight)).toBe('2026-11-03');
    });

    it('pads month and day', () => {
      expect(toIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
    });
  });

  describe('isValidIsoDate', () => {
    it.each(['2026-11-03', '2024-02-29', '2026-12-31'])('accepts %s', (value) => {
      expect(isValidIsoDate(value)).toBe(true);
    });

    it.each(['2026-02-29', '2026-02-30', '2026-13-01', '2026-00-10', '2026-1-3', '03/11/2026', ''])(
      'rejects "%s"',
      (value) => {
        expect(isValidIsoDate(value)).toBe(false);
      },
    );
  });

  describe('parseIsoDate', () => {
    it('returns local midnight', () => {
      const date = parseIsoDate('2026-11-03');
      expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()]).toEqual([2026, 10, 3, 0]);
    });

    it('throws on invalid dates', () => {
      expect(() => parseIsoDate('2026-02-30')).toThrow();
    });
  });

  describe('addDays', () => {
    it.each([
      ['2026-11-03', -1, '2026-11-02'],
      ['2026-11-30', 1, '2026-12-01'],
      ['2026-12-31', 1, '2027-01-01'],
      ['2024-02-28', 1, '2024-02-29'],
      ['2026-03-01', -1, '2026-02-28'],
      // Days around the European DST changes
      ['2026-03-28', 2, '2026-03-30'],
      ['2026-10-24', 2, '2026-10-26'],
    ])('%s %+i days → %s', (date, days, expected) => {
      expect(addDays(date, days)).toBe(expected);
    });
  });

  describe('months', () => {
    it('extracts the month of a date', () => {
      expect(toYearMonth('2026-11-03')).toBe('2026-11');
    });

    it.each([
      ['2026-11', 1, '2026-12'],
      ['2026-12', 1, '2027-01'],
      ['2026-01', -1, '2025-12'],
      ['2026-05', -12, '2025-05'],
    ])('%s %+i months → %s', (month, months, expected) => {
      expect(addMonths(month, months)).toBe(expected);
    });

    it.each([
      ['2026-11', 30],
      ['2026-12', 31],
      ['2026-02', 28],
      ['2024-02', 29],
    ])('%s has %i days', (month, days) => {
      expect(daysInMonth(month)).toBe(days);
    });

    it('returns the first and last day of the month', () => {
      expect(monthBounds('2024-02')).toEqual({ first: '2024-02-01', last: '2024-02-29' });
    });

    it('rejects invalid months', () => {
      expect(() => addMonths('2026-13', 1)).toThrow();
      expect(() => daysInMonth('2026-1')).toThrow();
    });
  });

  describe('monthsBetween', () => {
    it('counts months across years, in both directions', () => {
      expect(monthsBetween('2026-11', '2026-11')).toBe(0);
      expect(monthsBetween('2026-11', '2027-02')).toBe(3);
      expect(monthsBetween('2027-02', '2026-11')).toBe(-3);
    });
  });

  describe('daysBetween', () => {
    it('counts calendar days, across months, years and DST changes', () => {
      expect(daysBetween('2026-11-03', '2026-11-03')).toBe(0);
      expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
      expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2); // DST starts on 29 March
      expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2); // DST ends on 25 October
      expect(daysBetween('2026-11-10', '2026-11-01')).toBe(-9);
    });
  });

  describe('accounting periods', () => {
    it('validates the start day', () => {
      expect([1, 15, 16, 28].every(isValidMonthStartDay)).toBe(true);
      expect([0, 29, 31, 1.5, Number.NaN].some(isValidMonthStartDay)).toBe(false);
      expect(() => accountingPeriod('2026-11', 29)).toThrow();
      expect(() => accountingMonthOf('2026-11-03', 0)).toThrow();
    });

    it('with start 1 is the calendar month', () => {
      expect(accountingPeriod('2026-11', 1)).toEqual(monthBounds('2026-11'));
      expect(accountingPeriod('2024-02', 1)).toEqual({ first: '2024-02-01', last: '2024-02-29' });
      expect(accountingMonthOf('2026-11-30', 1)).toBe('2026-11');
      expect(accountingMonthOf('2026-12-01', 1)).toBe('2026-12');
    });

    it('with a start from 2 to 15 is named after the month in which it starts', () => {
      expect(accountingPeriod('2026-11', 10)).toEqual({ first: '2026-11-10', last: '2026-12-09' });
      expect(accountingPeriod('2026-11', 15)).toEqual({ first: '2026-11-15', last: '2026-12-14' });
      expect(accountingMonthOf('2026-11-09', 10)).toBe('2026-10');
      expect(accountingMonthOf('2026-11-10', 10)).toBe('2026-11');
      expect(accountingMonthOf('2026-12-09', 10)).toBe('2026-11');
    });

    it('with a start from 16 to 28 is named after the month in which it ends', () => {
      expect(accountingPeriod('2026-11', 16)).toEqual({ first: '2026-10-16', last: '2026-11-15' });
      expect(accountingPeriod('2026-11', 27)).toEqual({ first: '2026-10-27', last: '2026-11-26' });
      expect(accountingPeriod('2026-11', 28)).toEqual({ first: '2026-10-28', last: '2026-11-27' });
      expect(accountingMonthOf('2026-10-26', 27)).toBe('2026-10');
      expect(accountingMonthOf('2026-10-27', 27)).toBe('2026-11');
      expect(accountingMonthOf('2026-11-26', 27)).toBe('2026-11');
      expect(accountingMonthOf('2026-11-27', 27)).toBe('2026-12');
    });

    it('crosses the end of the year in both directions', () => {
      // Named by start: December runs into January.
      expect(accountingPeriod('2026-12', 10)).toEqual({ first: '2026-12-10', last: '2027-01-09' });
      expect(accountingMonthOf('2027-01-05', 10)).toBe('2026-12');
      // Named by end: January starts in December.
      expect(accountingPeriod('2027-01', 27)).toEqual({ first: '2026-12-27', last: '2027-01-26' });
      expect(accountingMonthOf('2026-12-31', 27)).toBe('2027-01');
      expect(accountingMonthOf('2026-12-26', 27)).toBe('2026-12');
    });

    it('handles February, leap years included', () => {
      expect(accountingPeriod('2026-02', 28)).toEqual({ first: '2026-01-28', last: '2026-02-27' });
      expect(accountingPeriod('2026-03', 28)).toEqual({ first: '2026-02-28', last: '2026-03-27' });
      expect(accountingPeriod('2026-02', 15)).toEqual({ first: '2026-02-15', last: '2026-03-14' });
      expect(accountingPeriodLength('2026-02', 15)).toBe(28);
      expect(accountingPeriodLength('2024-02', 15)).toBe(29);
      expect(accountingPeriodLength('2024-03', 20)).toBe(29); // 20 Feb – 19 Mar 2024
      expect(accountingMonthOf('2024-02-29', 28)).toBe('2024-03');
      expect(accountingMonthOf('2024-02-29', 1)).toBe('2024-02');
    });

    it('covers every day exactly once, for every start day', () => {
      for (let startDay = 1; startDay <= 28; startDay++) {
        let month = '2025-01';
        let expectedFirst = accountingPeriod(month, startDay).first;
        for (let i = 0; i < 26; i++) {
          const { first, last } = accountingPeriod(month, startDay);
          // Periods are contiguous: each one starts the day after the previous one ended.
          expect(first).toBe(expectedFirst);
          expect(accountingMonthOf(first, startDay)).toBe(month);
          expect(accountingMonthOf(last, startDay)).toBe(month);
          expect(accountingMonthOf(addDays(first, -1), startDay)).toBe(addMonths(month, -1));
          expect(accountingMonthOf(addDays(last, 1), startDay)).toBe(addMonths(month, 1));
          expectedFirst = addDays(last, 1);
          month = addMonths(month, 1);
        }
      }
    });

    it('regroups the same date when the start day changes', () => {
      const date = '2026-11-28';
      expect(accountingMonthOf(date, 1)).toBe('2026-11');
      expect(accountingMonthOf(date, 10)).toBe('2026-11');
      expect(accountingMonthOf(date, 27)).toBe('2026-12');
    });

    it('finds the current accounting month', () => {
      const now = new Date(2026, 10, 28, 9, 0); // 28 November 2026
      expect(currentAccountingMonth(1, now)).toBe('2026-11');
      expect(currentAccountingMonth(27, now)).toBe('2026-12');
    });
  });

  describe('nowIso', () => {
    it('returns an ISO 8601 UTC timestamp', () => {
      expect(nowIso(new Date(Date.UTC(2026, 10, 3, 14, 30)))).toBe('2026-11-03T14:30:00.000Z');
    });
  });
});
