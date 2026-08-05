const SHANGHAI_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;

export function todayInShanghai(): string {
  return formatShanghaiDate(new Date());
}

export function toShanghaiIso(localDateTime: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(localDateTime);
  if (!match) {
    return new Date(localDateTime).toISOString();
  }
  const [, year, month, day, hour, minute] = match;
  return new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
    ) - SHANGHAI_UTC_OFFSET_MS,
  ).toISOString();
}

export function toShanghaiIsoDate(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) {
    return new Date(date).toISOString();
  }
  const [, year, month, day] = match;
  return new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day)) -
      SHANGHAI_UTC_OFFSET_MS,
  ).toISOString();
}

export function addDays(date: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) {
    return date;
  }
  const [, year, month, day] = match;
  const shifted = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day) + days) -
      SHANGHAI_UTC_OFFSET_MS,
  );
  return formatShanghaiDate(shifted);
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Shanghai",
  }).format(new Date(iso));
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Shanghai",
  }).format(new Date(iso));
}

export function formatShanghaiDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Shanghai",
    year: "numeric",
  }).formatToParts(date);
  const byType = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${byType.year ?? "1970"}-${byType.month ?? "01"}-${byType.day ?? "01"}`;
}

export function isSameShanghaiDay(iso: string, date: string): boolean {
  return formatShanghaiDate(new Date(iso)) === date;
}

export function toLocalDateTimeInput(iso: string): string {
  const date = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Shanghai",
    year: "numeric",
  }).formatToParts(date);
  const byType = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${byType.year ?? "1970"}-${byType.month ?? "01"}-${byType.day ?? "01"}T${byType.hour ?? "00"}:${byType.minute ?? "00"}`;
}
