import { TestBed } from '@angular/core/testing';

import { setUpTestDatabase } from '../../../testing/test-database';
import type { Account } from '../models/account';
import type { Category } from '../models/category';
import { AccountsRepository } from '../repositories/accounts.repository';
import { CategoriesRepository } from '../repositories/categories.repository';
import { TransactionsRepository } from '../repositories/transactions.repository';

import { changePercent, comparisonRange, MonthSummaryService } from './month-summary.service';
import { PreferencesService } from './preferences.service';

describe('comparisonRange', () => {
  const november = { first: '2026-11-01', last: '2026-11-30' };
  const october = { first: '2026-10-01', last: '2026-10-31' };

  it('stops the previous month at the same day of the period', () => {
    expect(comparisonRange(november, october, '2026-11-15')).toEqual({ first: '2026-10-01', last: '2026-10-15' });
    expect(comparisonRange(november, october, '2026-11-01')).toEqual({ first: '2026-10-01', last: '2026-10-01' });
  });

  it('cuts the range to a shorter previous month', () => {
    const march = { first: '2026-03-01', last: '2026-03-31' };
    const february = { first: '2026-02-01', last: '2026-02-28' };
    expect(comparisonRange(march, february, '2026-03-31')).toEqual(february);
  });

  it('compares whole months when the month is not the current one', () => {
    expect(comparisonRange(november, october, '2026-12-03')).toEqual(october);
  });

  it('works with periods that cross the end of the year', () => {
    const january = { first: '2026-12-27', last: '2027-01-26' };
    const december = { first: '2026-11-27', last: '2026-12-26' };
    expect(comparisonRange(january, december, '2027-01-02')).toEqual({ first: '2026-11-27', last: '2026-12-03' });
  });
});

describe('changePercent', () => {
  it('rounds to whole percent and has no value without a previous amount', () => {
    expect(changePercent(11200, 10000)).toBe(12);
    expect(changePercent(9000, 10000)).toBe(-10);
    expect(changePercent(10000, 10000)).toBe(0);
    expect(changePercent(5000, 0)).toBeNull();
  });
});

describe('MonthSummaryService', () => {
  let service: MonthSummaryService;
  let transactions: TransactionsRepository;
  let checking: Account;
  let food: Category;

  const NOW = new Date(2026, 10, 15, 12, 0); // 15 November 2026

  beforeEach(async () => {
    await setUpTestDatabase();
    service = TestBed.inject(MonthSummaryService);
    transactions = TestBed.inject(TransactionsRepository);
    checking = await TestBed.inject(AccountsRepository).create({ name: 'Conto', type: 'checking' });
    const savings = await TestBed.inject(AccountsRepository).create({ name: 'Risparmi', type: 'savings' });
    const categories = TestBed.inject(CategoriesRepository);
    food = await categories.create({ name: 'Spesa', kind: 'expense', icon: 'cart-outline', color: 'teal' });
    const salary = await categories.create({
      name: 'Stipendio',
      kind: 'income',
      icon: 'briefcase-outline',
      color: 'teal',
    });

    await expense(10000, '2026-10-05');
    await expense(5000, '2026-10-20'); // after 15 October: not in the comparison
    await expense(11200, '2026-11-03');
    await expense(1000, '2026-11-28'); // later in the month: still spent this month
    await transactions.create({
      type: 'income',
      amountCents: 200000,
      accountId: checking.id,
      categoryId: salary.id,
      date: '2026-11-05',
    });
    await transactions.create({
      type: 'transfer',
      amountCents: 50000,
      accountId: checking.id,
      toAccountId: savings.id,
      date: '2026-11-05',
    });
  });

  function expense(amountCents: number, date: string) {
    return transactions.create({ type: 'expense', amountCents, accountId: checking.id, categoryId: food.id, date });
  }

  it('compares the current month with the previous one at the same date, expenses only', async () => {
    expect(await service.getSpending('2026-11', NOW)).toEqual({
      month: '2026-11',
      period: { first: '2026-11-01', last: '2026-11-30' },
      spentCents: 12200,
      previousRange: { first: '2026-10-01', last: '2026-10-15' },
      previousCents: 10000,
      changePercent: 22,
    });
  });

  it('compares whole months for a past month', async () => {
    const october = await service.getSpending('2026-10', NOW);
    expect(october).toEqual(expect.objectContaining({ spentCents: 15000, previousCents: 0, changePercent: null }));
  });

  it('follows the accounting month', async () => {
    await TestBed.inject(PreferencesService).setMonthStartDay(16);
    // "2026-11" = 16 October – 15 November; the previous one is 16 September – 15 October.
    const spending = await service.getSpending('2026-11', NOW);
    expect(spending.period).toEqual({ first: '2026-10-16', last: '2026-11-15' });
    expect(spending.spentCents).toBe(5000 + 11200);
    expect(spending.previousRange).toEqual({ first: '2026-09-16', last: '2026-10-15' });
    expect(spending.previousCents).toBe(10000);
  });
});
