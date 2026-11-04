import { inject, Injectable } from '@angular/core';

import { TransactionsRepository } from '../repositories/transactions.repository';
import type { IsoDate, YearMonth } from '../utils/dates';
import { accountingPeriod, addDays, addMonths, daysBetween, today } from '../utils/dates';

import { PreferencesService } from './preferences.service';

export interface DateRange {
  first: IsoDate;
  last: IsoDate;
}

/** "Speso questo mese" on the home page. */
export interface MonthSpending {
  month: YearMonth;
  period: DateRange;
  spentCents: number;
  /** The previous month up to the same day of the period (the whole of it for past months). */
  previousRange: DateRange;
  previousCents: number;
  /** Change in whole percent, rounded; null when the previous month has no expenses. */
  changePercent: number | null;
}

/**
 * Range of the previous month to compare with. For the current month it goes
 * up to the same day of the period ("1–15 ottobre" on 15 November), cut to
 * the previous period's length; otherwise it is the whole previous month.
 */
export function comparisonRange(period: DateRange, previous: DateRange, currentDate: IsoDate): DateRange {
  const isCurrent = currentDate >= period.first && currentDate <= period.last;
  if (!isCurrent) {
    return previous;
  }
  const sameDay = addDays(previous.first, daysBetween(period.first, currentDate));
  return { first: previous.first, last: sameDay < previous.last ? sameDay : previous.last };
}

/** Change from `previous` to `current` in whole percent, or null if there is nothing to compare with. */
export function changePercent(current: number, previous: number): number | null {
  return previous > 0 ? Math.round(((current - previous) * 100) / previous) : null;
}

/** Totals of a month for the home page. Expenses only: income and transfers never count. */
@Injectable({ providedIn: 'root' })
export class MonthSummaryService {
  private readonly transactions = inject(TransactionsRepository);
  private readonly preferences = inject(PreferencesService);

  async getSpending(month: YearMonth, now: Date = new Date()): Promise<MonthSpending> {
    const startDay = this.preferences.monthStartDay();
    const period = accountingPeriod(month, startDay);
    const previousRange = comparisonRange(period, accountingPeriod(addMonths(month, -1), startDay), today(now));
    const [spentCents, previousCents] = await Promise.all([
      this.totalExpenses(period),
      this.totalExpenses(previousRange),
    ]);
    return {
      month,
      period,
      spentCents,
      previousRange,
      previousCents,
      changePercent: changePercent(spentCents, previousCents),
    };
  }

  private async totalExpenses(range: DateRange): Promise<number> {
    const byCategory = await this.transactions.expenseByCategory(range.first, range.last);
    return [...byCategory.values()].reduce((sum, cents) => sum + cents, 0);
  }
}
