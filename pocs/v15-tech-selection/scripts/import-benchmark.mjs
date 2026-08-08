import { createReadStream, mkdirSync, statSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { parse } from "csv-parse";
import { readSheet } from "read-excel-file/node";

mkdirSync("results", { recursive: true });
const limits = {
  maxUploadBytes: 10 * 1024 * 1024,
  maxRows: 100_000,
  maxColumns: 64,
  maxCellCharacters: 64 * 1024,
  recommendedXlsxRows: 50_000,
};

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
    max_record_size: limits.maxCellCharacters * limits.maxColumns,
  }));
  for await (const row of parser) {
    rows += 1;
    columns = Math.max(columns, row.length);
    if (rows > limits.maxRows + 1) throw new Error("IMPORT_ROW_LIMIT_EXCEEDED");
    if (row.length > limits.maxColumns) throw new Error("IMPORT_COLUMN_LIMIT_EXCEEDED");
  }
  return {
    sizeBytes: size,
    rows,
    columns,
    durationMs: Math.round(performance.now() - started),
    rssDeltaBytes: process.memoryUsage().rss - before,
    acceptedByByteLimit: size <= limits.maxUploadBytes,
    acceptedByRowLimit: rows - 1 <= limits.maxRows,
  };
}

async function benchmarkXlsx(path) {
  const size = statSync(path).size;
  if (size > limits.maxUploadBytes) {
    return { sizeBytes: size, rejectedBeforeParse: true, reason: "IMPORT_FILE_TOO_LARGE" };
  }
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
    acceptedByRowLimit: rows.length - 1 <= limits.maxRows,
    warning: rows.length - 1 > limits.recommendedXlsxRows ? "XLSX_ABOVE_RECOMMENDED_ROWS" : null,
  };
}

const results = {
  environment: { node: process.version, platform: process.platform, arch: process.arch },
  limits,
  csv: await benchmarkCsv("fixtures/large-100k.csv"),
  xlsx: await benchmarkXlsx("fixtures/large-100k.xlsx"),
};
writeFileSync("results/04-import-performance.json", JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
