import { computed, inject, Injectable, signal } from '@angular/core';

import { PreferencesService } from '../core/services/preferences.service';
import type { YearMonth } from '../core/utils/dates';
import { accountingPeriod, addMonths, currentAccountingMonth } from '../core/utils/dates';

/**
 * The accounting month shown by Home and Budget. Shared, so that "Vedi tutti"
 * on the home opens the Budget page on the same month. Until the user moves
 * away, it follows the current month (and the month start preference).
 */
@Injectable({ providedIn: 'root' })
export class SelectedMonthService {
  private readonly preferences = inject(PreferencesService);
  private readonly chosen = signal<YearMonth | null>(null);

  /** Today's accounting month. */
  readonly current = computed(() => currentAccountingMonth(this.preferences.monthStartDay()));
  readonly month = computed(() => this.chosen() ?? this.current());
  readonly isCurrent = computed(() => this.month() === this.current());
  /** First and last day of the selected month. */
  readonly period = computed(() => accountingPeriod(this.month(), this.preferences.monthStartDay()));

  move(months: number): void {
    const target = addMonths(this.month(), months);
    // Back on the current month: follow it again.
    this.chosen.set(target === this.current() ? null : target);
  }

  goToCurrent(): void {
    this.chosen.set(null);
  }
}
