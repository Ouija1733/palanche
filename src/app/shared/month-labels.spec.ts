import { monthName, monthTitle, periodLabel } from './month-labels';

describe('month labels', () => {
  it('names the months in Italian', () => {
    expect(monthName('2026-10')).toBe('ottobre');
    expect(monthName('2027-01')).toBe('gennaio');
    expect(monthTitle('2026-11')).toBe('Novembre 2026');
    expect(monthTitle('2026-12')).toBe('Dicembre 2026');
  });

  it('writes the dates of a period', () => {
    expect(periodLabel('2026-10-27', '2026-11-26')).toBe('27 ott – 26 nov');
    expect(periodLabel('2026-12-27', '2027-01-26')).toBe('27 dic – 26 gen');
    expect(periodLabel('2026-10-01', '2026-10-15')).toBe('1–15 ott');
  });
});
