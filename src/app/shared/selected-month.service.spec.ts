import { TestBed } from '@angular/core/testing';

import { setUpTestDatabase } from '../../testing/test-database';
import { PreferencesService } from '../core/services/preferences.service';

import { SelectedMonthService } from './selected-month.service';

describe('SelectedMonthService', () => {
  let months: SelectedMonthService;

  beforeEach(async () => {
    vi.useFakeTimers({ now: new Date(2026, 10, 28, 10, 0), toFake: ['Date'] }); // 28 November 2026
    await setUpTestDatabase();
    months = TestBed.inject(SelectedMonthService);
  });

  afterEach(() => vi.useRealTimers());

  it('starts on the current accounting month', () => {
    expect(months.month()).toBe('2026-11');
    expect(months.isCurrent()).toBe(true);
    expect(months.period()).toEqual({ first: '2026-11-01', last: '2026-11-30' });
  });

  it('moves across years and back to the current month', () => {
    months.move(2);
    expect(months.month()).toBe('2027-01');
    expect(months.isCurrent()).toBe(false);
    months.move(-2);
    expect(months.isCurrent()).toBe(true);
    months.move(-1);
    months.goToCurrent();
    expect(months.month()).toBe('2026-11');
  });

  it('follows the month start preference while on the current month', async () => {
    await TestBed.inject(PreferencesService).setMonthStartDay(27);
    // 28 November is already in the period named December (27 Nov – 26 Dec).
    expect(months.month()).toBe('2026-12');
    expect(months.period()).toEqual({ first: '2026-11-27', last: '2026-12-26' });
  });
});
