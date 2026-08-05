export const BUSINESS_TIME_ZONE = "Asia/Shanghai";

const MONTH_PATTERN = /^(19|20)\d{2}-(0[1-9]|1[0-2])$/;
const SHANGHAI_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;

export function isValidMonth(month: string): boolean {
  if (!MONTH_PATTERN.test(month)) {
    return false;
  }
  const parts = month.split("-");
  const year = Number(parts[0]);
  const monthNumber = Number(parts[1]);
  return year >= 1900 && year <= 2099 && monthNumber >= 1 && monthNumber <= 12;
}

export function currentMonth(): string {
  const now = new Date();
  const parts = zonedParts(now);
  return `${parts.year}-${parts.month}`;
}

export function toZonedDay(date: Date): string {
  const parts = zonedParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function monthBounds(month: string): { start: Date; end: Date } {
  const parts = month.split("-");
  const year = Number(parts[0]);
  const monthNumber = Number(parts[1]);
  if (!Number.isInteger(year) || !Number.isInteger(monthNumber)) {
    throw new Error(`Invalid month: ${month}`);
  }
  // Asia/Shanghai is UTC+8 without daylight saving time.
  const start = new Date(
    Date.UTC(year, monthNumber - 1, 1) - SHANGHAI_UTC_OFFSET_MS,
  );
  const end = new Date(Date.UTC(year, monthNumber, 1) - SHANGHAI_UTC_OFFSET_MS);
  return { start, end };
}

export function dayBounds(day: string): { start: Date; end: Date } {
  const parts = day.split("-");
  const year = Number(parts[0]);
  const monthNumber = Number(parts[1]);
  const dayNumber = Number(parts[2]);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(monthNumber) ||
    !Number.isInteger(dayNumber)
  ) {
    throw new Error(`Invalid day: ${day}`);
  }
  const start = new Date(
    Date.UTC(year, monthNumber - 1, dayNumber) - SHANGHAI_UTC_OFFSET_MS,
  );
  const end = new Date(
    Date.UTC(year, monthNumber - 1, dayNumber + 1) - SHANGHAI_UTC_OFFSET_MS,
  );
  return { start, end };
}

function zonedParts(date: Date): { year: string; month: string; day: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
  }).formatToParts(date);
  const byType = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return {
    day: byType.day ?? "01",
    month: byType.month ?? "01",
    year: byType.year ?? "1970",
  };
}
