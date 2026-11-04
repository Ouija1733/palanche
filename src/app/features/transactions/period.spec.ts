import { periodRange } from './period';

describe('periodRange', () => {
  const now = new Date(2026, 0, 15, 10, 0); // 15 January 2026

  it('covers the whole current month', () => {
    expect(periodRange('thisMonth', 1, now)).toEqual({ from: '2026-01-01', to: '2026-01-31' });
  });

  it('goes back across the year for last month', () => {
    expect(periodRange('lastMonth', 1, now)).toEqual({ from: '2025-12-01', to: '2025-12-31' });
  });

  it('follows the accounting month when it does not start on the 1st', () => {
    // Start 27: on 15 January the current period is 27 December – 26 January.
    expect(periodRange('thisMonth', 27, now)).toEqual({ from: '2025-12-27', to: '2026-01-26' });
    expect(periodRange('lastMonth', 27, now)).toEqual({ from: '2025-11-27', to: '2025-12-26' });
    // Start 10: on 15 January the current period is 10 January – 9 February.
    expect(periodRange('thisMonth', 10, now)).toEqual({ from: '2026-01-10', to: '2026-02-09' });
  });

  it('counts today as one of the last 30 days', () => {
    expect(periodRange('last30Days', 1, now)).toEqual({ from: '2025-12-17', to: '2026-01-15' });
  });

  it('covers the current year', () => {
    expect(periodRange('thisYear', 1, now)).toEqual({ from: '2026-01-01', to: '2026-12-31' });
  });

  it('has no bounds for "all"', () => {
    expect(periodRange('all', 1, now)).toEqual({});
  });
});
