const SHANGHAI_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function isShanghaiMidnight(date: Date): boolean {
  return (date.getTime() + SHANGHAI_UTC_OFFSET_MS) % DAY_MS === 0;
}
