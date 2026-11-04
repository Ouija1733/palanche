import type { TransactionListItem } from '../../core/models/transaction';
import type { IsoDate } from '../../core/utils/dates';

export interface DayGroup {
  date: IsoDate;
  items: TransactionListItem[];
}

/**
 * Groups a list already sorted by date (newest first) into consecutive days,
 * keeping the order of the transactions inside each day.
 */
export function groupByDay(items: readonly TransactionListItem[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const item of items) {
    const last = groups.at(-1);
    if (last?.date === item.date) {
      last.items.push(item);
    } else {
      groups.push({ date: item.date, items: [item] });
    }
  }
  return groups;
}
