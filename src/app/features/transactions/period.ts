import type { IsoDate } from '../../core/utils/dates';
import { accountingPeriod, addDays, addMonths, currentAccountingMonth, today } from '../../core/utils/dates';

/** Period presets offered by the "Periodo" filter. */
export type PeriodPreset = 'thisMonth' | 'lastMonth' | 'last30Days' | 'thisYear' | 'all';

export const PERIOD_LABELS: Readonly<Record<PeriodPreset, string>> = {
  thisMonth: 'Questo mese',
  lastMonth: 'Mese scorso',
  last30Days: 'Ultimi 30 giorni',
  thisYear: "Quest'anno",
  all: 'Sempre',
};

export const PERIOD_PRESETS = Object.keys(PERIOD_LABELS) as PeriodPreset[];

/**
 * Date range of a preset (both ends included); "all" has no bounds. The two
 * month presets follow the accounting month, which starts on `monthStartDay`.
 */
export function periodRange(
  preset: PeriodPreset,
  monthStartDay: number,
  now: Date = new Date(),
): { from?: IsoDate; to?: IsoDate } {
  const current = today(now);
  const month = currentAccountingMonth(monthStartDay, now);
  switch (preset) {
    case 'thisMonth': {
      const { first, last } = accountingPeriod(month, monthStartDay);
      return { from: first, to: last };
    }
    case 'lastMonth': {
      const { first, last } = accountingPeriod(addMonths(month, -1), monthStartDay);
      return { from: first, to: last };
    }
    case 'last30Days':
      return { from: addDays(current, -29), to: current };
    case 'thisYear': {
      const year = current.slice(0, 4);
      return { from: `${year}-01-01`, to: `${year}-12-31` };
    }
    case 'all':
      return {};
  }
}
