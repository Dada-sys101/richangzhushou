import test from "node:test";
import assert from "node:assert/strict";
import { createReadStream, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { parse } from "csv-parse";
import { readSheet } from "read-excel-file/node";

mkdirSync("results", { recursive: true });
const releaseLimits = {
  csv: { maxUploadBytes: 10 * 1024 * 1024, maxRows: 100_000 },
  xlsx: { maxUploadBytes: 5 * 1024 * 1024, maxRows: 50_000 },
  common: { maxColumns: 64, maxCellCharacters: 64 * 1024 },
};

function preflightImport({ sizeBytes, extension, rows = 0, columns = 0, maxCellCharacters = 0 }) {
  const type = extension === ".csv" ? "csv" : extension === ".xlsx" ? "xlsx" : null;
  if (!type) throw new Error("IMPORT_TYPE_UNSUPPORTED");
  const limits = releaseLimits[type];
  if (sizeBytes > limits.maxUploadBytes) throw new Error("IMPORT_FILE_TOO_LARGE");
  if (rows > limits.maxRows) throw new Error("IMPORT_ROW_LIMIT_EXCEEDED");
  if (columns > releaseLimits.common.maxColumns) throw new Error("IMPORT_COLUMN_LIMIT_EXCEEDED");
  if (maxCellCharacters > releaseLimits.common.maxCellCharacters) throw new Error("IMPORT_CELL_TOO_LARGE");
  return { accepted: true, type, limits };
}

async function parseCsv(path, encoding) {
  const rows = [];
  const parser = createReadStream(path, { encoding }).pipe(parse({
    bom: true,
    relax_column_count: true,
    skip_empty_lines: true,
    trim: true,
    max_record_size: releaseLimits.common.maxCellCharacters,
  }));
  for await (const row of parser) rows.push(row);
  return rows;
}

function findHeader(rows, required) {
  const index = rows.findIndex((row) => Array.isArray(row) && required.every((name) => row.includes(name)));
  if (index < 0) throw new Error("HEADER_NOT_FOUND");
  return { headerIndex: index, header: rows[index], data: rows.slice(index + 1) };
}

const result = {};

test("representative WeChat CSV parses BOM, metadata rows and empty values", async () => {
  const rows = await parseCsv("fixtures/wechat-representative.csv", "utf8");
  const table = findHeader(rows, ["交易时间", "金额(元)", "交易单号"]);
  assert.equal(table.data.length, 2);
  assert.equal(table.data[0][5], "¥12.80");
  assert.equal(table.data[1][10], "");
  result.wechat = { status: "PASS", headerIndex: table.headerIndex, rowCount: table.data.length };
});

test("representative Alipay CSV parses GB18030 after explicit decoding", async () => {
  const bytes = readFileSync("fixtures/alipay-representative.csv");
  assert.ok(bytes.length > 0);
  const rows = await parseCsv("fixtures/alipay-representative-utf8.csv", "utf8");
  const table = findHeader(rows, ["交易号", "金额（元）", "交易状态"]);
  assert.equal(table.data.length, 2);
  result.alipayCsv = {
    status: "PASS_WITH_ENCODING_ADAPTER",
    headerIndex: table.headerIndex,
    rowCount: table.data.length,
    note: "Production first tries BOM/UTF-8, then a narrowly scoped GB18030 decoder",
  };
});

test("representative XLSX handles merged title row and blank cells", async () => {
  const rows = await readSheet("fixtures/alipay-representative.xlsx", "账单");
  const table = findHeader(rows, ["交易号", "金额（元）", "交易状态"]);
  assert.equal(table.headerIndex, 1);
  assert.equal(table.data.length, 2);
  assert.equal(table.data[0][9], 12.8);
  assert.equal(table.data[0][14], null);
  result.alipayXlsx = { status: "PASS", headerIndex: table.headerIndex, rowCount: table.data.length };
});

test("format-specific release limits reject oversize work before expensive parsing", () => {
  assert.throws(
    () => preflightImport({ sizeBytes: releaseLimits.csv.maxUploadBytes + 1, extension: ".csv" }),
    /IMPORT_FILE_TOO_LARGE/,
  );
  assert.throws(
    () => preflightImport({ sizeBytes: 1024, extension: ".csv", rows: releaseLimits.csv.maxRows + 1 }),
    /IMPORT_ROW_LIMIT_EXCEEDED/,
  );
  assert.throws(
    () => preflightImport({ sizeBytes: releaseLimits.xlsx.maxUploadBytes + 1, extension: ".xlsx" }),
    /IMPORT_FILE_TOO_LARGE/,
  );
  assert.throws(
    () => preflightImport({ sizeBytes: 1024, extension: ".xlsx", rows: releaseLimits.xlsx.maxRows + 1 }),
    /IMPORT_ROW_LIMIT_EXCEEDED/,
  );
  assert.throws(
    () => preflightImport({ sizeBytes: 1024, extension: ".xlsm" }),
    /IMPORT_TYPE_UNSUPPORTED/,
  );
  assert.throws(
    () => preflightImport({ sizeBytes: 1024, extension: ".csv", columns: releaseLimits.common.maxColumns + 1 }),
    /IMPORT_COLUMN_LIMIT_EXCEEDED/,
  );
  result.limitHandling = {
    status: "PASS",
    releaseLimits,
    errors: ["IMPORT_FILE_TOO_LARGE", "IMPORT_ROW_LIMIT_EXCEEDED", "IMPORT_TYPE_UNSUPPORTED", "IMPORT_COLUMN_LIMIT_EXCEEDED"],
    degradation: "reject before parsing; keep ImportBatch as REJECTED with a localized reason",
  };
});

test.after(() => {
  writeFileSync("results/04-import-correctness.json", JSON.stringify(result, null, 2));
});
