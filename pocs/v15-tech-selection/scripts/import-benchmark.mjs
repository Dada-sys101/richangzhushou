import { createReadStream, mkdirSync, statSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { parse } from "csv-parse";
import { readSheet } from "read-excel-file/node";

mkdirSync("results", { recursive: true });
const releaseLimits = {
  csv: { maxUploadBytes: 10 * 1024 * 1024, maxRows: 100_000 },
  xlsx: { maxUploadBytes: 5 * 1024 * 1024, maxRows: 50_000 },
  common: { maxColumns: 64, maxCellCharacters: 64 * 1024 },
};
const stressProfile = { rows: 100_000, purpose: "measure resource amplification beyond the XLSX release limit" };

async function benchmarkCsv(path) {
  const size = statSync(path).size;
  const before = process.memoryUsage().rss;
  const started = performance.now();
  let rows = 0;
  let columns = 0;
  const parser = createReadStream(path).pipe(parse({
    bom: true,
    skip_empty_lines: true,
    relax_column_count: true,
    max_record_size: releaseLimits.common.maxCellCharacters * releaseLimits.common.maxColumns,
  }));
  for await (const row of parser) {
    rows += 1;
    columns = Math.max(columns, row.length);
    if (row.length > releaseLimits.common.maxColumns) throw new Error("IMPORT_COLUMN_LIMIT_EXCEEDED");
  }
  return {
    sizeBytes: size,
    rows,
    columns,
    durationMs: Math.round(performance.now() - started),
    rssDeltaBytes: process.memoryUsage().rss - before,
    acceptedByReleaseByteLimit: size <= releaseLimits.csv.maxUploadBytes,
    acceptedByReleaseRowLimit: rows - 1 <= releaseLimits.csv.maxRows,
  };
}

async function benchmarkXlsx(path) {
  const size = statSync(path).size;
  const before = process.memoryUsage().rss;
  const started = performance.now();
  const rows = await readSheet(path, 1);
  const columns = rows.reduce((max, row) => Math.max(max, row.length), 0);
  return {
    sizeBytes: size,
    rows: rows.length,
    columns,
    durationMs: Math.round(performance.now() - started),
    rssDeltaBytes: process.memoryUsage().rss - before,
    acceptedByReleaseByteLimit: size <= releaseLimits.xlsx.maxUploadBytes,
    acceptedByReleaseRowLimit: rows.length - 1 <= releaseLimits.xlsx.maxRows,
    stressResult: "PARSED_FOR_BENCHMARK_ONLY_NOT_ACCEPTED_BY_RELEASE_GATE",
  };
}

const results = {
  environment: { node: process.version, platform: process.platform, arch: process.arch },
  releaseLimits,
  stressProfile,
  csv: await benchmarkCsv("fixtures/large-100k.csv"),
  xlsx: await benchmarkXlsx("fixtures/large-100k.xlsx"),
};
writeFileSync("results/04-import-performance.json", JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
