import { inject, Injectable, signal } from '@angular/core';

import { SettingsRepository } from '../repositories/settings.repository';
import { DEFAULT_MONTH_START_DAY, isValidMonthStartDay } from '../utils/dates';

import { DataChangesService } from './data-changes.service';
import { DomainError } from './domain-error';

/** Reads a stored start day; anything missing or invalid falls back to the default. */
export function parseMonthStartDay(value: string | null): number {
  const day = value === null ? Number.NaN : Number(value);
  return isValidMonthStartDay(day) ? day : DEFAULT_MONTH_START_DAY;
}

/**
 * User preferences, stored in the `settings` table and kept in signals so that
 * pages can use them synchronously. `load()` runs at startup (main.ts) and
 * after a backup restore, which may change them.
 */
@Injectable({ providedIn: 'root' })
export class PreferencesService {
  private readonly settings = inject(SettingsRepository);
  private readonly changes = inject(DataChangesService);

  private readonly startDay = signal(DEFAULT_MONTH_START_DAY);

  /** First day (1–28) of the accounting month. */
  readonly monthStartDay = this.startDay.asReadonly();

  async load(): Promise<void> {
    this.startDay.set(parseMonthStartDay(await this.settings.get('month_start_day')));
  }

  /** Changes how transactions are grouped into months; no stored data changes. */
  async setMonthStartDay(day: number): Promise<void> {
    if (!isValidMonthStartDay(day)) {
      throw new DomainError('INVALID_MONTH_START_DAY', `Invalid month start day: ${day}`);
    }
    await this.settings.set('month_start_day', String(day));
    this.startDay.set(day);
    this.changes.notify();
  }
}
