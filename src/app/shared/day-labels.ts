import type { IsoDate } from '../core/utils/dates';
import { addDays, parseIsoDate, today } from '../core/utils/dates';

const weekdayFormat = new Intl.DateTimeFormat('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
const weekdayYearFormat = new Intl.DateTimeFormat('it-IT', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const shortFormat = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short' });
const shortYearFormat = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });

/** "Oggi", "Ieri", or null for any other day. */
export function relativeDay(date: IsoDate, now: Date = new Date()): string | null {
  const current = today(now);
  if (date === current) {
    return 'Oggi';
  }
  return date === addDays(current, -1) ? 'Ieri' : null;
}

function isCurrentYear(date: IsoDate, now: Date): boolean {
  return date.slice(0, 4) === today(now).slice(0, 4);
}

/**
 * Heading of a day in the transactions list: "Oggi · dom 15 nov",
 * "Ieri · sab 14 nov", "ven 13 nov"; the year only when it is not the current one.
 */
export function dayHeading(date: IsoDate, now: Date = new Date()): string {
  const format = isCurrentYear(date, now) ? weekdayFormat : weekdayYearFormat;
  const label = format.format(parseIsoDate(date));
  const relative = relativeDay(date, now);
  return relative ? `${relative} · ${label}` : label;
}

/** Compact day for a transaction row: "Oggi", "Ieri", "12 nov", "12 nov 2025". */
export function shortDay(date: IsoDate, now: Date = new Date()): string {
  const relative = relativeDay(date, now);
  if (relative) {
    return relative;
  }
  return (isCurrentYear(date, now) ? shortFormat : shortYearFormat).format(parseIsoDate(date));
}
