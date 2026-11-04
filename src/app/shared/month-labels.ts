import type { IsoDate, YearMonth } from '../core/utils/dates';
import { parseIsoDate } from '../core/utils/dates';

const MONTH_NAMES = [
  'gennaio',
  'febbraio',
  'marzo',
  'aprile',
  'maggio',
  'giugno',
  'luglio',
  'agosto',
  'settembre',
  'ottobre',
  'novembre',
  'dicembre',
] as const;

const dayMonthFormat = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short' });

/** "ottobre" (lower case, as inside a sentence: "Copia da ottobre"). */
export function monthName(month: YearMonth): string {
  return MONTH_NAMES[Number(month.slice(5, 7)) - 1];
}

/** "Novembre 2026", the title of the month selector. */
export function monthTitle(month: YearMonth): string {
  const name = monthName(month);
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${month.slice(0, 4)}`;
}

/**
 * Dates of an accounting period: "27 ott – 26 nov". When both ends are in the
 * same calendar month the month is written once: "1–15 ott".
 */
export function periodLabel(first: IsoDate, last: IsoDate): string {
  if (first.slice(0, 7) === last.slice(0, 7)) {
    return `${Number(first.slice(8))}–${dayMonthFormat.format(parseIsoDate(last))}`;
  }
  return `${dayMonthFormat.format(parseIsoDate(first))} – ${dayMonthFormat.format(parseIsoDate(last))}`;
}
