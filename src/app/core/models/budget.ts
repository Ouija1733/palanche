import type { YearMonth } from '../utils/dates';

/** Spending limit of a category (or of the whole month) for one accounting month. */
export interface Budget {
  id: string;
  /** null = total budget of the month. */
  categoryId: string | null;
  /** Accounting month, "YYYY-MM". */
  month: YearMonth;
  amountCents: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export type NewBudget = Pick<Budget, 'categoryId' | 'month' | 'amountCents'>;
