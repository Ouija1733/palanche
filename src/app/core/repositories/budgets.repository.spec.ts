import { TestBed } from '@angular/core/testing';

import { setUpTestDatabase } from '../../../testing/test-database';
import type { Category } from '../models/category';

import { BudgetsRepository } from './budgets.repository';
import { CategoriesRepository } from './categories.repository';

describe('BudgetsRepository', () => {
  let budgets: BudgetsRepository;
  let categories: CategoriesRepository;
  let fun: Category;
  let home: Category;

  beforeEach(async () => {
    await setUpTestDatabase();
    budgets = TestBed.inject(BudgetsRepository);
    categories = TestBed.inject(CategoriesRepository);
    fun = await categories.create({ name: 'Svago', kind: 'expense', icon: 'film-outline', color: 'pink' });
    home = await categories.create({ name: 'Casa', kind: 'expense', icon: 'home-outline', color: 'violet' });
  });

  it('creates budgets and finds those of a month', async () => {
    const funBudget = await budgets.create({ categoryId: fun.id, month: '2026-11', amountCents: 10000 });
    const total = await budgets.create({ categoryId: null, month: '2026-11', amountCents: 95000 });
    await budgets.create({ categoryId: home.id, month: '2026-10', amountCents: 15000 });

    expect(await budgets.findByMonth('2026-11')).toEqual([funBudget, total]);
    expect(await budgets.findById(funBudget.id)).toEqual(funBudget);
  });

  it('finds the budget of a category or the total', async () => {
    const funBudget = await budgets.create({ categoryId: fun.id, month: '2026-11', amountCents: 10000 });
    const total = await budgets.create({ categoryId: null, month: '2026-11', amountCents: 95000 });

    expect(await budgets.findOne('2026-11', fun.id)).toEqual(funBudget);
    expect(await budgets.findOne('2026-11', null)).toEqual(total);
    expect(await budgets.findOne('2026-11', home.id)).toBeNull();
    expect(await budgets.findOne('2026-12', null)).toBeNull();
  });

  it('updates the amount', async () => {
    const budget = await budgets.create({ categoryId: fun.id, month: '2026-11', amountCents: 10000 });
    const updated = await budgets.updateAmount(budget.id, 12000);
    expect(updated.amountCents).toBe(12000);
    expect(updated.updatedAt >= budget.updatedAt).toBe(true);
    await expect(budgets.updateAmount('nope', 1)).rejects.toThrow();
  });

  it('soft deletes and restores', async () => {
    const budget = await budgets.create({ categoryId: fun.id, month: '2026-11', amountCents: 10000 });
    expect(await budgets.softDelete(budget.id)).toBe(true);
    expect(await budgets.findByMonth('2026-11')).toEqual([]);
    expect(await budgets.findOne('2026-11', fun.id)).toBeNull();
    expect(await budgets.softDelete(budget.id)).toBe(false);

    expect(await budgets.restore(budget.id)).toBe(true);
    expect((await budgets.findByMonth('2026-11')).map((b) => b.id)).toEqual([budget.id]);
    expect(await budgets.restore(budget.id)).toBe(false);
  });

  it('hides the budgets of deleted categories', async () => {
    await budgets.create({ categoryId: fun.id, month: '2026-11', amountCents: 10000 });
    await categories.softDelete(fun.id);
    expect(await budgets.findByMonth('2026-11')).toEqual([]);
  });

  it('keeps deleted rows for the backup and can replace the table', async () => {
    const kept = await budgets.create({ categoryId: fun.id, month: '2026-11', amountCents: 10000 });
    const deleted = await budgets.create({ categoryId: null, month: '2026-11', amountCents: 95000 });
    await budgets.softDelete(deleted.id);
    const all = await budgets.findAllIncludingDeleted();
    expect(all.map((b) => b.id).sort()).toEqual([kept.id, deleted.id].sort());

    await budgets.deleteAll();
    expect(await budgets.findAllIncludingDeleted()).toEqual([]);
    await budgets.upsertAll(all);
    expect(await budgets.findAllIncludingDeleted()).toEqual(all);
  });
});
