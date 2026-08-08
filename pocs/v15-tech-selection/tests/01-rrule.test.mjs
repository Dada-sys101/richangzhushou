import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { DateTime } from "luxon";
import { RRuleTemporal } from "rrule-temporal";

mkdirSync("results", { recursive: true });
const zone = "America/New_York";
const expectedLocal = [
  "2026-03-01 09:00 EST",
  "2026-03-08 09:00 EDT",
  "2026-03-15 09:00 EDT",
  "2026-03-22 09:00 EDT",
];
const expectedInstants = [
  "2026-03-01T14:00:00.000Z",
  "2026-03-08T13:00:00.000Z",
  "2026-03-15T13:00:00.000Z",
  "2026-03-22T13:00:00.000Z",
];

function runRruleJsInHostZone(hostZone) {
  const output = execFileSync(process.execPath, ["scripts/rrule-child.mjs"], {
    cwd: process.cwd(),
    env: { ...process.env, TZ: hostZone },
    encoding: "utf8",
  });
  return JSON.parse(output);
}

function splitSeries(occurrences, splitIndex, replacementLocalHour) {
  assert(splitIndex > 0 && splitIndex < occurrences.length);
  const before = occurrences.slice(0, splitIndex);
  const split = occurrences[splitIndex];
  const start = DateTime.fromISO(split, { setZone: true }).set({
    hour: replacementLocalHour,
  });
  const after = Array.from(
    { length: occurrences.length - splitIndex },
    (_, index) => start.plus({ weeks: index }).toISO(),
  );
  return { before, after, originalRecurrenceId: split };
}

const result = { candidateA: {}, candidateB: {}, domainSemantics: {} };

test("candidate A: record rrule.js + Luxon behavior across host zones and DST", () => {
  const hostZones = ["UTC", "Asia/Shanghai", "America/Los_Angeles"];
  const runs = hostZones.map(runRruleJsInHostZone);
  const instantMatches = runs.every(
    (run) =>
      JSON.stringify(run.normalized.map((item) => item.instant)) ===
      JSON.stringify(expectedInstants),
  );
  const localMatches = runs.every(
    (run) =>
      JSON.stringify(run.normalized.map((item) => item.seriesLocal)) ===
      JSON.stringify(expectedLocal),
  );
  result.candidateA = {
    status: instantMatches && localMatches ? "PASS" : "FAIL",
    reason:
      instantMatches && localMatches
        ? null
        : "DST boundary output depends on ambiguous Date normalization and produced an incorrect instant",
    expectedInstants,
    expectedLocal,
    hostZones: runs,
  };
  assert.equal(runs.length, 3);
});

test("candidate B: rrule-temporal returns explicit ZonedDateTime values across DST", () => {
  const rule = new RRuleTemporal({
    rruleString: `DTSTART;TZID=${zone}:20260301T090000\nRRULE:FREQ=WEEKLY;COUNT=4`,
    strict: true,
  });
  const occurrences = rule.all();
  const local = occurrences.map((value) =>
    value.toLocaleString("en-US", {
      timeZoneName: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }),
  );
  const instants = occurrences.map((value) => value.toInstant().toString());
  assert.deepEqual(
    instants,
    expectedInstants.map((value) => value.replace(".000Z", "Z")),
  );
  assert.equal(
    occurrences.every((value) => value.hour === 9 && value.timeZoneId === zone),
    true,
  );
  result.candidateB = {
    status: "PASS",
    zonedValues: occurrences.map((value) => value.toString()),
    local,
    instants,
  };
});

test("cross-timezone policy distinguishes WALL_CLOCK from ABSOLUTE_INSTANT", () => {
  const wallClockInstants = expectedInstants;
  const viewedInTokyo = wallClockInstants.map((value) =>
    DateTime.fromISO(value, { zone: "utc" })
      .setZone("Asia/Tokyo")
      .toFormat("yyyy-LL-dd HH:mm ZZZZ"),
  );
  const absoluteInstants = Array.from({ length: 4 }, (_, index) =>
    DateTime.fromISO(expectedInstants[0], { zone: "utc" })
      .plus({ days: index * 7 })
      .toISO(),
  );
  const absoluteInNewYork = absoluteInstants.map((value) =>
    DateTime.fromISO(value, { zone: "utc" })
      .setZone(zone)
      .toFormat("yyyy-LL-dd HH:mm ZZZZ"),
  );
  assert.deepEqual(absoluteInNewYork, [
    "2026-03-01 09:00 EST",
    "2026-03-08 10:00 EDT",
    "2026-03-15 10:00 EDT",
    "2026-03-22 10:00 EDT",
  ]);
  result.domainSemantics.timezonePolicy = {
    recommendation:
      "User plans use WALL_CLOCK + series TZID; system jobs may use ABSOLUTE_INSTANT",
    viewedInTokyo,
    absoluteInNewYork,
  };
});

test("series editing supports only-this and this-and-following without overlap", () => {
  const base = expectedInstants.map((value) =>
    DateTime.fromISO(value, { zone: "utc" }).setZone(zone).toISO(),
  );
  const onlyThis = {
    originalRecurrenceId: base[1],
    replacement: DateTime.fromISO(base[1], { setZone: true })
      .set({ hour: 11 })
      .toISO(),
  };
  assert.equal(base[1].includes("T09:00"), true);
  assert.equal(onlyThis.replacement.includes("T11:00"), true);

  const split = splitSeries(base, 2, 10);
  assert.equal(split.before.length + split.after.length, base.length);
  assert.equal(split.before.at(-1) < split.after[0], true);
  assert.equal(
    split.after.every((value) => value.includes("T10:00")),
    true,
  );
  result.domainSemantics.seriesEditing = { onlyThis, split };
});

test.after(() => {
  writeFileSync("results/01-rrule.json", JSON.stringify(result, null, 2));
});
