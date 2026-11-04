import { TestBed } from '@angular/core/testing';

import { setUpTestDatabase } from '../../../testing/test-database';
import type { Account } from '../models/account';
import type { Category } from '../models/category';
import { AccountsRepository } from '../repositories/accounts.repository';
import { BudgetsRepository } from '../repositories/budgets.repository';
import { CategoriesRepository } from '../repositories/categories.repository';
import { TransactionsRepository } from '../repositories/transactions.repository';

import { budgetPercent, BudgetService, budgetStatus, reachedThresholds } from './budget.service';
import { PreferencesService } from './preferences.service';

describe('budget rules', () => {
  it.each([
    [0, 'ok', 0],
    [7999, 'ok', 79],
    [8000, 'warning', 80],
    [9999, 'warning', 99],
    [10000, 'warning', 100],
    [10001, 'over', 100],
    [11200, 'over', 112],
  ] as const)('spending %i of 10000 is %s at %i%%', (spent, status, percent) => {
    expect(budgetStatus(spent, 10000)).toBe(status);
    expect(budgetPercent(spent, 10000)).toBe(percent);
  });

  it('never shows 80% for a spending just below the threshold', () => {
    // 79.99%: rounding would say 80% while the bar is still green.
    expect(budgetPercent(7999, 10000)).toBe(79);
    expect(budgetStatus(7999, 10000)).toBe('ok');
  });

  it('reaches the alert thresholds at 80% and 100%', () => {
    expect(reachedThresholds(7999, 10000)).toEqual([]);
    expect(reachedThresholds(8000, 10000)).toEqual([80]);
    expect(reachedThresholds(10000, 10000)).toEqual([80, 100]);
    expect(reachedThresholds(15000, 10000)).toEqual([80, 100]);
  });
});

describe('BudgetService', () => {
  let service: BudgetService;
  let transactions: TransactionsRepository;
  let budgets: BudgetsRepository;
  let checking: Account;
  let fun: Category;
  let home: Category;
  let rent: Category;
  let food: Category;
  let travel: Category;
  let salary: Category;

  const NOW = new Date(2026, 10, 15, 12, 0); // 15 November 2026

  beforeEach(async () => {
    await setUpTestDatabase();
    service = TestBed.inject(BudgetService);
    transactions = TestBed.inject(TransactionsRepository);
    budgets = TestBed.inject(BudgetsRepository);
    const categories = TestBed.inject(CategoriesRepository);
    checking = await TestBed.inject(AccountsRepository).create({ name: 'Conto', type: 'checking' });
    const savings = await TestBed.inject(AccountsRepository).create({ name: 'Risparmi', type: 'savings' });
    fun = await categories.create({ name: 'Svago', kind: 'expense', icon: 'film-outline', color: 'pink' });
    home = await categories.create({ name: 'Casa', kind: 'expense', icon: 'home-outline', color: 'violet' });
    rent = await categories.create({
      name: 'Affitto',
      kind: 'expense',
      icon: 'home-outline',
      color: 'violet',
      parentId: home.id,
    });
    food = await categories.create({ name: 'Spesa', kind: 'expense', icon: 'cart-outline', color: 'teal' });
    travel = await categories.create({ name: 'Viaggi', kind: 'expense', icon: 'airplane-outline', color: 'cyan' });
    salary = await categories.create({ name: 'Stipendio', kind: 'income', icon: 'briefcase-outline', color: 'teal' });

    // November 2026 (calendar month).
    await expense(fun, 11200, '2026-11-03');
    await expense(home, 1000, '2026-11-02');
    await expense(rent, 3500, '2026-11-01'); // counts for Casa
    await expense(food, 24300, '2026-11-10');
    await expense(travel, 5000, '2026-11-20');
    await expense(fun, 9999, '2026-10-31'); // October
    const deleted = await expense(food, 9999, '2026-11-11');
    await transactions.softDelete(deleted.id);
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

  function expense(category: Category, amountCents: number, date: string) {
    return transactions.create({ type: 'expense', amountCents, accountId: checking.id, categoryId: category.id, date });
  }

  it('computes every budget line, subcategories included, most consumed first', async () => {
    await service.setBudget('2026-11', food.id, 30000);
    await service.setBudget('2026-11', fun.id, 10000);
    await service.setBudget('2026-11', home.id, 15000);

    const month = await service.getMonth('2026-11', NOW);
    expect(
      month.lines.map((line) => [line.category?.name, line.spentCents, line.remainingCents, line.percent, line.status]),
    ).toEqual([
      ['Svago', 11200, -1200, 112, 'over'],
      ['Spesa', 24300, 5700, 81, 'warning'],
      ['Casa', 4500, 10500, 30, 'ok'],
    ]);
  });

  it('without a total budget, the total is the sum of the category budgets', async () => {
    await service.setBudget('2026-11', food.id, 30000);
    await service.setBudget('2026-11', fun.id, 10000);

    const { total } = await service.getMonth('2026-11', NOW);
    // Travel (5000) and Casa (4500) have no budget, so they are not counted.
    expect(total).toEqual(
      expect.objectContaining({ amountCents: 40000, spentCents: 35500, remainingCents: 4500, budget: null }),
    );
  });

  it('an explicit total budget covers every expense of the month', async () => {
    await service.setBudget('2026-11', fun.id, 10000);
    const totalBudget = await service.setBudget('2026-11', null, 95000);

    const month = await service.getMonth('2026-11', NOW);
    expect(month.total).toEqual(
      expect.objectContaining({
        amountCents: 95000,
        spentCents: 45000,
        percent: 47,
        status: 'ok',
        budget: totalBudget,
      }),
    );
    expect(month.lines).toHaveLength(1);
  });

  it('works with only a total budget', async () => {
    await service.setBudget('2026-11', null, 40000);
    const month = await service.getMonth('2026-11', NOW);
    expect(month.total).toEqual(expect.objectContaining({ spentCents: 45000, status: 'over' }));
    expect(month.lines).toEqual([]);
  });

  it('has no total when the month has no budget', async () => {
    const month = await service.getMonth('2026-11', NOW);
    expect(month.total).toBeNull();
    expect(month.lines).toEqual([]);
  });

  it('lists the main categories with spending but no budget', async () => {
    await service.setBudget('2026-11', fun.id, 10000);
    const { unbudgeted } = await service.getMonth('2026-11', NOW);
    expect(unbudgeted.map((item) => [item.category.name, item.spentCents])).toEqual([
      ['Spesa', 24300],
      ['Viaggi', 5000],
      ['Casa', 4500],
    ]);
  });

  it('marks where you should be today only in the current month', async () => {
    const current = await service.getMonth('2026-11', NOW);
    expect(current.pace).toBeCloseTo(15 / 30);
    expect(current.daysLeft).toBe(15);

    const past = await service.getMonth('2026-10', NOW);
    expect(past.pace).toBeNull();
    expect(past.daysLeft).toBeNull();
  });

  it('follows the accounting month when it does not start on the 1st', async () => {
    await TestBed.inject(PreferencesService).setMonthStartDay(27);
    await service.setBudget('2026-11', fun.id, 10000);

    // "2026-11" is now 27 October – 26 November: the 31 October expense counts, the 20 November one too.
    const month = await service.getMonth('2026-11', NOW);
    expect(month.period).toEqual({ first: '2026-10-27', last: '2026-11-26' });
    expect(month.lines[0].spentCents).toBe(11200 + 9999);
    expect(month.daysLeft).toBe(11);
  });

  describe('setBudget', () => {
    it('updates the existing budget instead of creating a second one', async () => {
      const first = await service.setBudget('2026-11', fun.id, 10000);
      const second = await service.setBudget('2026-11', fun.id, 12000);
      expect(second.id).toBe(first.id);
      expect(await budgets.findByMonth('2026-11')).toEqual([expect.objectContaining({ amountCents: 12000 })]);
    });

    it.each([0, -100, 12.5])('rejects the amount %s', async (amount) => {
      await expect(service.setBudget('2026-11', fun.id, amount)).rejects.toMatchObject({ code: 'INVALID_AMOUNT' });
    });

    it('rejects subcategories, income categories and missing categories', async () => {
      for (const id of [rent.id, salary.id, 'nope']) {
        await expect(service.setBudget('2026-11', id, 1000)).rejects.toMatchObject({
          code: 'BUDGET_CATEGORY_INVALID',
        });
      }
    });

    it('rejects an invalid month', async () => {
      await expect(service.setBudget('2026-13', fun.id, 1000)).rejects.toThrow();
    });
  });

  it('removes a budget and restores it', async () => {
    const budget = await service.setBudget('2026-11', fun.id, 10000);
    await service.removeBudget(budget.id);
    expect((await service.getMonth('2026-11', NOW)).lines).toEqual([]);
    await service.restoreBudget(budget.id);
    expect((await service.getMonth('2026-11', NOW)).lines).toHaveLength(1);
  });

  it('refuses to restore a budget whose place was taken', async () => {
    const budget = await service.setBudget('2026-11', fun.id, 10000);
    await service.removeBudget(budget.id);
    await service.setBudget('2026-11', fun.id, 20000);
    await expect(service.restoreBudget(budget.id)).rejects.toMatchObject({ code: 'BUDGET_EXISTS' });
  });

  describe('copyFromPreviousMonth', () => {
    it('copies every budget of the previous month, the total included', async () => {
      await service.setBudget('2026-10', fun.id, 10000);
      await service.setBudget('2026-10', food.id, 30000);
      await service.setBudget('2026-10', null, 95000);

      expect(await service.copyFromPreviousMonth('2026-11')).toBe(3);
      const copied = await budgets.findByMonth('2026-11');
      expect(copied.map((b) => [b.categoryId, b.amountCents]).sort()).toEqual(
        [
          [fun.id, 10000],
          [food.id, 30000],
          [null, 95000],
        ].sort(),
      );
    });

    it('keeps the budgets already set in the month', async () => {
      await service.setBudget('2026-10', fun.id, 10000);
      await service.setBudget('2026-10', food.id, 30000);
      await service.setBudget('2026-11', fun.id, 15000);

      expect(await service.copyFromPreviousMonth('2026-11')).toBe(1);
      expect((await budgets.findOne('2026-11', fun.id))?.amountCents).toBe(15000);
      expect((await budgets.findOne('2026-11', food.id))?.amountCents).toBe(30000);
    });

    it('crosses the year and copies nothing from an empty month', async () => {
      await service.setBudget('2026-12', fun.id, 10000);
      expect(await service.copyFromPreviousMonth('2027-01')).toBe(1);
      expect(await service.copyFromPreviousMonth('2026-12')).toBe(0);
    });

    it('skips removed budgets and those of deleted categories', async () => {
      const removed = await service.setBudget('2026-10', fun.id, 10000);
      await service.removeBudget(removed.id);
      await service.setBudget('2026-10', travel.id, 10000);
      await TestBed.inject(CategoriesRepository).softDelete(travel.id);
      expect(await service.copyFromPreviousMonth('2026-11')).toBe(0);
    });
  });
});
