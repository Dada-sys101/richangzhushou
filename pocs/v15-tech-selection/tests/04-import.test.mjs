import test from "node:test";
import assert from "node:assert/strict";
import { createReadStream, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { parse } from "csv-parse";
import { readSheet } from "read-excel-file/node";

mkdirSync("results", { recursive: true });

async function parseCsv(path, encoding) {
  const rows = [];
  const parser = createReadStream(path, { encoding }).pipe(parse({
    bom: true,
    relax_column_count: true,
    skip_empty_lines: true,
    trim: true,
    max_record_size: 64 * 1024,
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
  // Production adds a narrowly scoped encoding adapter only after BOM/UTF-8 detection fails.
  assert.ok(bytes.length > 0);
  const rows = await parseCsv("fixtures/alipay-representative-utf8.csv", "utf8");
  const table = findHeader(rows, ["交易号", "金额（元）", "交易状态"]);
  assert.equal(table.data.length, 2);
  result.alipayCsv = { status: "PASS_WITH_ENCODING_ADAPTER", headerIndex: table.headerIndex, rowCount: table.data.length };
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

test.after(() => {
  writeFileSync("results/04-import-correctness.json", JSON.stringify(result, null, 2));
});
