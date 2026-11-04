/**
 * Date helpers. Accounting dates are plain "YYYY-MM-DD" strings in local time,
 * months are "YYYY-MM": no timestamps, so time zones can never shift a
 * transaction to the previous or next day.
 *
 * Functions that depend on "now" take it as an optional parameter, so tests
 * can pass a fixed date.
 */

/** A calendar date, "YYYY-MM-DD". */
export type IsoDate = string;
/** A calendar month, "YYYY-MM". */
export type YearMonth = string;

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const YEAR_MONTH_PATTERN = /^(\d{4})-(\d{2})$/;

const pad2 = (value: number): string => String(value).padStart(2, '0');

/**
 * Formats a Date using its local components. Note: `toISOString()` would use
 * UTC and return yesterday's date between midnight and 1–2 AM in Italy.
 */
export function toIsoDate(date: Date): IsoDate {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Today's date in local time. */
export function today(now: Date = new Date()): IsoDate {
  return toIsoDate(now);
}

/** True if the string is a real calendar date ("2026-02-30" is not). */
export function isValidIsoDate(value: string): boolean {
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) {
    return false;
  }
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/** Converts "YYYY-MM-DD" to a Date at local midnight. Throws if invalid. */
export function parseIsoDate(value: IsoDate): Date {
  if (!isValidIsoDate(value)) {
    throw new Error(`Invalid date: "${value}"`);
  }
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** Adds (or subtracts) days. Works across months, years and DST changes. */
export function addDays(date: IsoDate, days: number): IsoDate {
  const d = parseIsoDate(date);
  // The Date constructor normalises overflowing days (e.g. 32 January → 1 February).
  return toIsoDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days));
}

/** "2026-11-03" → "2026-11". */
export function toYearMonth(date: IsoDate): YearMonth {
  parseIsoDate(date);
  return date.slice(0, 7);
}

function parseYearMonth(month: YearMonth): [number, number] {
  const match = YEAR_MONTH_PATTERN.exec(month);
  const year = Number(match?.[1]);
  const monthNumber = Number(match?.[2]);
  if (!match || monthNumber < 1 || monthNumber > 12) {
    throw new Error(`Invalid month: "${month}"`);
  }
  return [year, monthNumber];
}

/** Adds (or subtracts) months: "2026-12" + 1 → "2027-01". */
export function addMonths(month: YearMonth, months: number): YearMonth {
  const [year, monthNumber] = parseYearMonth(month);
  const date = new Date(year, monthNumber - 1 + months, 1);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

/** Number of days in the month (leap years included). */
export function daysInMonth(month: YearMonth): number {
  const [year, monthNumber] = parseYearMonth(month);
  // Day 0 of the next month is the last day of this one.
  return new Date(year, monthNumber, 0).getDate();
}

/** First and last day of the month, handy for "date BETWEEN ? AND ?" queries. */
export function monthBounds(month: YearMonth): { first: IsoDate; last: IsoDate } {
  parseYearMonth(month);
  return { first: `${month}-01`, last: `${month}-${pad2(daysInMonth(month))}` };
}

/** Days from `from` to `to` (negative if `to` comes first). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  const utc = (date: IsoDate) => {
    const d = parseIsoDate(date);
    // UTC midnights: a DST change would otherwise make a day 23 or 25 hours long.
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  };
  return Math.round((utc(to) - utc(from)) / 86_400_000);
}

// ---------------------------------------------------------------------------
// Accounting periods
//
// The accounting month can start on any day from 1 to 28 (a preference, e.g.
// the salary day). A period is named after the calendar month that holds most
// of its days: with a start from 1 to 15 it is the month in which it starts,
// from 16 to 28 the month in which it ends. With start 27, "2026-11" is
// 27 October – 26 November; with start 10 it is 10 November – 9 December.
//
// Every period calculation (budgets, monthly spending, comparisons, month
// selector, filters) goes through these functions. Changing the start day
// changes no stored data: budgets keep their "YYYY-MM" name, only the dates
// that fall in it change.
// ---------------------------------------------------------------------------

export const MIN_MONTH_START_DAY = 1;
/** 28 at most, so that every month has the start day (February included). */
export const MAX_MONTH_START_DAY = 28;
export const DEFAULT_MONTH_START_DAY = 1;

/** Last start day for which a period is named after the month in which it starts. */
const LAST_START_DAY_NAMED_BY_START = 15;

export function isValidMonthStartDay(value: number): boolean {
  return Number.isInteger(value) && value >= MIN_MONTH_START_DAY && value <= MAX_MONTH_START_DAY;
}

function assertMonthStartDay(startDay: number): void {
  if (!isValidMonthStartDay(startDay)) {
    throw new Error(`Invalid month start day: ${startDay}`);
  }
}

/** First and last day (both included) of the accounting month. */
export function accountingPeriod(month: YearMonth, startDay: number): { first: IsoDate; last: IsoDate } {
  assertMonthStartDay(startDay);
  const startMonth = startDay <= LAST_START_DAY_NAMED_BY_START ? month : addMonths(month, -1);
  const first = `${startMonth}-${pad2(startDay)}`;
  const nextFirst = `${addMonths(startMonth, 1)}-${pad2(startDay)}`;
  return { first, last: addDays(nextFirst, -1) };
}

/** The accounting month a date belongs to: the inverse of `accountingPeriod`. */
export function accountingMonthOf(date: IsoDate, startDay: number): YearMonth {
  assertMonthStartDay(startDay);
  const month = toYearMonth(date);
  const day = Number(date.slice(8, 10));
  // Month in which the period that contains the date started.
  const startMonth = day >= startDay ? month : addMonths(month, -1);
  return startDay <= LAST_START_DAY_NAMED_BY_START ? startMonth : addMonths(startMonth, 1);
}

/** Today's accounting month. */
export function currentAccountingMonth(startDay: number, now: Date = new Date()): YearMonth {
  return accountingMonthOf(today(now), startDay);
}

/** Number of days in the accounting month. */
export function accountingPeriodLength(month: YearMonth, startDay: number): number {
  const { first, last } = accountingPeriod(month, startDay);
  return daysBetween(first, last) + 1;
}

/**
 * Current instant as an ISO 8601 timestamp (UTC), used for the technical
 * columns created_at / updated_at / deleted_at, never for accounting dates.
 */
export function nowIso(now: Date = new Date()): string {
  return now.toISOString();
}
