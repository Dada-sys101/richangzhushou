import rrulePackage from "rrule";
import { DateTime } from "luxon";

const { rrulestr } = rrulePackage;
const zone = "America/New_York";
const input = `DTSTART;TZID=${zone}:20260301T090000\nRRULE:FREQ=WEEKLY;COUNT=4`;
const rule = rrulestr(input);

// rrule.js represents timezone-aware occurrences as zero-offset Date objects whose
// components must be normalized using the host timezone as documented by rrule.js.
const normalized = rule.all().map((date) => {
  const instant = DateTime.fromJSDate(date)
    .toUTC()
    .setZone("local", { keepLocalTime: true })
    .toUTC();
  return {
    raw: date.toISOString(),
    instant: instant.toISO(),
    seriesLocal: instant.setZone(zone).toFormat("yyyy-LL-dd HH:mm ZZZZ"),
  };
});

process.stdout.write(JSON.stringify({
  hostZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  normalized,
}));
