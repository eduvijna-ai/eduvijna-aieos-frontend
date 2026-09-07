import { toCalendarDate } from "./calendarDate";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

function padDay(day: number): string {
  return String(day);
}

/** Format a YYYY-MM-DD lesson date as "7 Sep 2026". Invalid values pass through. */
export function formatLessonDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return value;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return value;
  return `${padDay(day)} ${MONTHS[month - 1]} ${year}`;
}

function formatClock(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatCalendarDay(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

/** Human submitted timestamp: "today at 10:30 AM" or "20 Aug 2026 at 3:30 PM". */
export function formatSubmittedAt(value: string, now: Date = new Date()): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const time = formatClock(date);
  if (toCalendarDate(date) === toCalendarDate(now)) {
    return `today at ${time}`;
  }
  return `${formatCalendarDay(date)} at ${time}`;
}

/** Compact calendar day for review headers, e.g. "Sep 7, 2026". */
export function formatSubmittedDay(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return formatCalendarDay(date);
}
