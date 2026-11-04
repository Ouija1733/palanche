import { periodRange } from './period';

describe('periodRange', () => {
  const now = new Date(2026, 0, 15, 10, 0); // 15 January 2026

  it('covers the whole current month', () => {
    expect(periodRange('thisMonth', now)).toEqual({ from: '2026-01-01', to: '2026-01-31' });
  });

  it('goes back across the year for last month', () => {
    expect(periodRange('lastMonth', now)).toEqual({ from: '2025-12-01', to: '2025-12-31' });
  });

  it('counts today as one of the last 30 days', () => {
    expect(periodRange('last30Days', now)).toEqual({ from: '2025-12-17', to: '2026-01-15' });
  });

  it('covers the current year', () => {
    expect(periodRange('thisYear', now)).toEqual({ from: '2026-01-01', to: '2026-12-31' });
  });

  it('has no bounds for "all"', () => {
    expect(periodRange('all', now)).toEqual({});
  });
});
