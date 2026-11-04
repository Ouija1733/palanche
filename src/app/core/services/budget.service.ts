import { inject, Injectable } from '@angular/core';

import { DatabaseService } from '../db/database.service';
import type { Budget } from '../models/budget';
import type { Category } from '../models/category';
import { BudgetsRepository } from '../repositories/budgets.repository';
import { CategoriesRepository } from '../repositories/categories.repository';
import { TransactionsRepository } from '../repositories/transactions.repository';
import type { IsoDate, YearMonth } from '../utils/dates';
import { accountingPeriod, addMonths, daysBetween, today } from '../utils/dates';

import { DataChangesService } from './data-changes.service';
import { DomainError } from './domain-error';
import { PreferencesService } from './preferences.service';

/** ok below 80%, warning from 80% to 100% included, over beyond 100%. */
export type BudgetStatus = 'ok' | 'warning' | 'over';

/** Thresholds (percent) at which the user is notified. */
export const BUDGET_ALERT_THRESHOLDS = [80, 100] as const;
export type BudgetAlertThreshold = (typeof BUDGET_ALERT_THRESHOLDS)[number];

/** Whole percentage spent, rounded down so that 79.9% never shows as 80%. */
export function budgetPercent(spentCents: number, budgetCents: number): number {
  return Math.floor((spentCents * 100) / budgetCents);
}

/** The single rule for the colour of a budget (integer maths, no rounding errors). */
export function budgetStatus(spentCents: number, budgetCents: number): BudgetStatus {
  if (spentCents > budgetCents) {
    return 'over';
  }
  return spentCents * 100 >= budgetCents * 80 ? 'warning' : 'ok';
}

/** Alert thresholds the spending has reached (80: at least 80%, 100: the whole budget). */
export function reachedThresholds(spentCents: number, budgetCents: number): BudgetAlertThreshold[] {
  return BUDGET_ALERT_THRESHOLDS.filter((threshold) => spentCents * 100 >= budgetCents * threshold);
}

export interface BudgetLine {
  budget: Budget;
  /** null for the total budget of the month. */
  category: Category | null;
  spentCents: number;
  /** Negative when the budget is exceeded. */
  remainingCents: number;
  percent: number;
  status: BudgetStatus;
}

/** Top of the Budget page: the explicit total budget, or the sum of the category budgets. */
export interface BudgetTotal {
  amountCents: number;
  spentCents: number;
  remainingCents: number;
  percent: number;
  status: BudgetStatus;
  /** The explicit total budget, if set; otherwise the total is the sum of the category budgets. */
  budget: Budget | null;
}

export interface UnbudgetedSpending {
  category: Category;
  spentCents: number;
}

export interface MonthBudgets {
  month: YearMonth;
  period: { first: IsoDate; last: IsoDate };
  /** null when the month has no budget at all. */
  total: BudgetTotal | null;
  /** Category budgets, most consumed first. */
  lines: BudgetLine[];
  /** Main categories with spending but no budget, highest spending first. */
  unbudgeted: UnbudgetedSpending[];
  /** For the current month only: share of the period elapsed (0–1), the "where you should be today" mark. */
  pace: number | null;
  /** For the current month only: days left after today. */
  daysLeft: number | null;
}

function line(budget: Budget, category: Category | null, spentCents: number): BudgetLine {
  return {
    budget,
    category,
    spentCents,
    remainingCents: budget.amountCents - spentCents,
    percent: budgetPercent(spentCents, budget.amountCents),
    status: budgetStatus(spentCents, budget.amountCents),
  };
}

function budgetTotal(amountCents: number, spentCents: number, budget: Budget | null): BudgetTotal {
  return {
    amountCents,
    spentCents,
    remainingCents: amountCents - spentCents,
    percent: budgetPercent(spentCents, amountCents),
    status: budgetStatus(spentCents, amountCents),
    budget,
  };
}

/**
 * Monthly budgets. A budget on a main category covers its subcategories too.
 * Months are accounting months (see utils/dates.ts): the period of a month
 * depends on the start day in the preferences.
 */
@Injectable({ providedIn: 'root' })
export class BudgetService {
  private readonly database = inject(DatabaseService);
  private readonly budgets = inject(BudgetsRepository);
  private readonly categories = inject(CategoriesRepository);
  private readonly transactions = inject(TransactionsRepository);
  private readonly preferences = inject(PreferencesService);
  private readonly changes = inject(DataChangesService);

  async getMonth(month: YearMonth, now: Date = new Date()): Promise<MonthBudgets> {
    const period = accountingPeriod(month, this.preferences.monthStartDay());
    const [budgets, categories, ownSpending] = await Promise.all([
      this.budgets.findByMonth(month),
      this.categories.findAll({ kind: 'expense' }),
      this.transactions.expenseByCategory(period.first, period.last),
    ]);

    // Spending of each category including its subcategories.
    const spending = new Map<string, number>();
    for (const category of categories) {
      const own = ownSpending.get(category.id) ?? 0;
      for (const id of [category.id, category.parentId]) {
        if (id) {
          spending.set(id, (spending.get(id) ?? 0) + own);
        }
      }
    }
    const allExpensesCents = [...ownSpending.values()].reduce((sum, cents) => sum + cents, 0);

    const byId = new Map(categories.map((category) => [category.id, category]));
    const lines = budgets
      .flatMap((budget) => {
        const category = budget.categoryId === null ? undefined : byId.get(budget.categoryId);
        return category ? [line(budget, category, spending.get(category.id) ?? 0)] : [];
      })
      // Most consumed first (compares spent / amount without dividing), then by name.
      .sort(
        (a, b) =>
          b.spentCents * a.budget.amountCents - a.spentCents * b.budget.amountCents ||
          (a.category?.name ?? '').localeCompare(b.category?.name ?? '', 'it'),
      );

    const budgeted = new Set(lines.map((budgetLine) => budgetLine.budget.categoryId));
    const unbudgeted = categories
      .filter((category) => category.parentId === null && !budgeted.has(category.id))
      .map((category) => ({ category, spentCents: spending.get(category.id) ?? 0 }))
      .filter((item) => item.spentCents > 0)
      .sort((a, b) => b.spentCents - a.spentCents);

    const totalBudget = budgets.find((budget) => budget.categoryId === null) ?? null;
    let total: BudgetTotal | null = null;
    if (totalBudget) {
      // An explicit total covers every expense of the month.
      total = budgetTotal(totalBudget.amountCents, allExpensesCents, totalBudget);
    } else if (lines.length > 0) {
      // Otherwise the total is the sum of the category budgets and of their spending.
      total = budgetTotal(
        lines.reduce((sum, item) => sum + item.budget.amountCents, 0),
        lines.reduce((sum, item) => sum + item.spentCents, 0),
        null,
      );
    }

    const currentDate = today(now);
    const isCurrent = currentDate >= period.first && currentDate <= period.last;
    const length = daysBetween(period.first, period.last) + 1;
    return {
      month,
      period,
      total,
      lines,
      unbudgeted,
      pace: isCurrent ? (daysBetween(period.first, currentDate) + 1) / length : null,
      daysLeft: isCurrent ? daysBetween(currentDate, period.last) : null,
    };
  }

  /** Sets the budget of a main expense category (or the total, with categoryId null). */
  async setBudget(month: YearMonth, categoryId: string | null, amountCents: number): Promise<Budget> {
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      throw new DomainError('INVALID_AMOUNT', 'A budget must be a positive integer amount of cents');
    }
    addMonths(month, 0); // throws on an invalid month
    const saved = await this.database.db.transaction(async (tx) => {
      if (categoryId !== null) {
        const category = await this.categories.findById(categoryId, tx);
        if (!category || category.kind !== 'expense' || category.parentId !== null) {
          throw new DomainError('BUDGET_CATEGORY_INVALID', 'Budgets apply to main expense categories only');
        }
      }
      const existing = await this.budgets.findOne(month, categoryId, tx);
      return existing
        ? this.budgets.updateAmount(existing.id, amountCents, tx)
        : this.budgets.create({ month, categoryId, amountCents }, tx);
    });
    this.changes.notify();
    return saved;
  }

  async removeBudget(id: string): Promise<void> {
    await this.budgets.softDelete(id);
    this.changes.notify();
  }

  /** The "Annulla" of the toast. Refused if a new budget took its place in the meantime. */
  async restoreBudget(id: string): Promise<void> {
    try {
      await this.budgets.restore(id);
    } catch {
      throw new DomainError('BUDGET_EXISTS', 'Another budget for the same category and month exists');
    }
    this.changes.notify();
  }

  /**
   * Copies the budgets of the previous month (the total included) where this
   * month has none yet. Returns how many were copied.
   */
  async copyFromPreviousMonth(month: YearMonth): Promise<number> {
    const copied = await this.database.db.transaction(async (tx) => {
      const previous = await this.budgets.findByMonth(addMonths(month, -1), tx);
      const current = await this.budgets.findByMonth(month, tx);
      const taken = new Set(current.map((budget) => budget.categoryId));
      const missing = previous.filter((budget) => !taken.has(budget.categoryId));
      for (const budget of missing) {
        await this.budgets.create({ month, categoryId: budget.categoryId, amountCents: budget.amountCents }, tx);
      }
      return missing.length;
    });
    if (copied > 0) {
      this.changes.notify();
    }
    return copied;
  }
}
