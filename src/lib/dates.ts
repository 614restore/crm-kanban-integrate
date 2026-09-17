// Dates the app shows and stores, for people in any timezone.
//
// Two different things get called a "date":
//   - A moment in time (an appointment's start, a created_at): stored in UTC and
//     shown in whatever timezone the viewer is in. toLocaleString does that.
//   - A calendar date ("2026-09-18"): the day itself, with no timezone. It must
//     never be shifted, or an evening in the Americas becomes the next day.
//
// JavaScript blurs the two: `new Date('2026-09-18')` is midnight UTC (the 17th
// in the Americas), and `date.toISOString().slice(0, 10)` gives the UTC day, not
// the day the person is living in. These helpers keep calendar dates local.

/** A calendar date parsed as that day where the user is. Values with a time are left alone. */
export function parseLocalDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  const plainDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec((value ?? '').trim());
  if (plainDate) {
    const [, year, month, day] = plainDate;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }
  return new Date(value);
}

/**
 * A moment as its calendar date where the user is, as YYYY-MM-DD — what a date
 * input expects and what a plain date column should hold. Defaults to today.
 */
export function toLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Midnight where the user is, for comparing against calendar dates. */
export function startOfLocalDay(value: string | Date = new Date()): Date {
  const date = parseLocalDate(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
