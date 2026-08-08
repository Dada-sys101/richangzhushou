import { createReadStream, mkdirSync, statSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { parse } from "csv-parse";
import { readSheet } from "read-excel-file/node";
import { IMPORT_LIMITS } from "../lib/import-core.mjs";

mkdirSync("results", { recursive: true });

const stressProfile = {
  rows: 100_000,
  purpose:
    "measure CSV streaming and XLSX resource amplification beyond the XLSX release limit",
};

function megabytes(bytes) {
  return Math.round((bytes / 1024 / 1024) * 100) / 100;
}

function amplification(deltaBytes, fileBytes) {
  if (fileBytes === 0) return null;
  return Math.round((deltaBytes / fileBytes) * 100) / 100;
}

async function benchmarkCsv(path) {
  const size = statSync(path).size;
  const before = process.memoryUsage().rss;
  const started = performance.now();
  let rows = 0;
  let columns = 0;
  let maxCellCharacters = 0;
  const parser = createReadStream(path).pipe(
    parse({
      bom: true,
      skip_empty_lines: true,
      relax_column_count: true,
      max_record_size:
        IMPORT_LIMITS.common.maxCellCharacters *
        IMPORT_LIMITS.common.maxColumns,
    }),
  );
  for await (const row of parser) {
    rows += 1;
    columns = Math.max(columns, row.length);
    maxCellCharacters = Math.max(
      maxCellCharacters,
      ...row.map((cell) => String(cell ?? "").length),
    );
    if (row.length > IMPORT_LIMITS.common.maxColumns) {
      throw new Error("IMPORT_COLUMN_LIMIT_EXCEEDED");
    }
    if (maxCellCharacters > IMPORT_LIMITS.common.maxCellCharacters) {
      throw new Error("IMPORT_CELL_TOO_LARGE");
    }
    if (rows - 1 > IMPORT_LIMITS.csv.maxRows) {
      throw new Error("IMPORT_ROW_LIMIT_EXCEEDED");
    }
  }
  const rssDeltaBytes = Math.max(0, process.memoryUsage().rss - before);
  return {
    strategy: "NODE_STREAM",
    sizeBytes: size,
    rows,
    dataRows: Math.max(0, rows - 1),
    columns,
    maxCellCharacters,
    durationMs: Math.round(performance.now() - started),
    rssDeltaBytes,
    rssDeltaMiB: megabytes(rssDeltaBytes),
    rssAmplificationVsFile: amplification(rssDeltaBytes, size),
    acceptedByReleaseByteLimit: size <= IMPORT_LIMITS.csv.maxUploadBytes,
    acceptedByReleaseRowLimit: rows - 1 <= IMPORT_LIMITS.csv.maxRows,
  };
}

async function benchmarkXlsx(path) {
  const size = statSync(path).size;
  const before = process.memoryUsage().rss;
  const started = performance.now();
  const rows = await readSheet(path, 1);
  const columns = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const maxCellCharacters = rows.reduce(
    (max, row) =>
      Math.max(max, ...row.map((cell) => String(cell ?? "").length)),
    0,
  );
  const rssDeltaBytes = Math.max(0, process.memoryUsage().rss - before);
  return {
    strategy: "WORKBOOK_IN_MEMORY",
    sizeBytes: size,
    rows: rows.length,
    dataRows: Math.max(0, rows.length - 1),
    columns,
    maxCellCharacters,
    durationMs: Math.round(performance.now() - started),
    rssDeltaBytes,
    rssDeltaMiB: megabytes(rssDeltaBytes),
    rssAmplificationVsFile: amplification(rssDeltaBytes, size),
    acceptedByReleaseByteLimit: size <= IMPORT_LIMITS.xlsx.maxUploadBytes,
    acceptedByReleaseRowLimit: rows.length - 1 <= IMPORT_LIMITS.xlsx.maxRows,
    stressResult: "PARSED_FOR_BENCHMARK_ONLY_NOT_ACCEPTED_BY_RELEASE_GATE",
  };
}

const results = {
  environment: {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
  },
  releaseLimits: IMPORT_LIMITS,
  stressProfile,
  csv: await benchmarkCsv("fixtures/large-100k.csv"),
  xlsx: await benchmarkXlsx("fixtures/large-100k.xlsx"),
};

results.gate = {
  csvStreamingValidated:
    results.csv.strategy === "NODE_STREAM" &&
    results.csv.acceptedByReleaseRowLimit &&
    results.csv.columns <= IMPORT_LIMITS.common.maxColumns,
  xlsxReleaseGateRejectsStressFile:
    !results.xlsx.acceptedByReleaseRowLimit ||
    !results.xlsx.acceptedByReleaseByteLimit,
  xlsxMemoryAmplificationRecorded:
    Number.isFinite(results.xlsx.rssAmplificationVsFile),
};

if (!Object.values(results.gate).every(Boolean)) {
  throw new Error("IMPORT_BENCHMARK_GATE_FAILED");
}

writeFileSync(
  "results/04-import-performance.json",
  JSON.stringify(results, null, 2),
);
console.log(JSON.stringify(results, null, 2));
