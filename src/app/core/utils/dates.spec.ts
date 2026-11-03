import {
  addDays,
  addMonths,
  daysInMonth,
  isValidIsoDate,
  monthBounds,
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

  describe('nowIso', () => {
    it('returns an ISO 8601 UTC timestamp', () => {
      expect(nowIso(new Date(Date.UTC(2026, 10, 3, 14, 30)))).toBe('2026-11-03T14:30:00.000Z');
    });
  });
});
