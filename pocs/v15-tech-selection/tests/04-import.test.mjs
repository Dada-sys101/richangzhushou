import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import {
  IMPORT_BATCH_STATES,
  IMPORT_ERROR_MESSAGES_ZH_CN,
  IMPORT_LIMITS,
  IMPORT_POLICIES,
  ImportError,
  executeImportBatch,
  findHeader,
  preflightImport,
  prepareImportRows,
} from "../lib/import-core.mjs";
import {
  parseCsvBytes,
  parseCsvFile,
  parseCsvText,
  parseXlsxFile,
  validateWorkbookRows,
} from "../lib/import-node.mjs";

mkdirSync("results", { recursive: true });
const result = {};

function assertImportError(error, code) {
  return error instanceof ImportError && error.code === code;
}

function wechatRows() {
  return [
    ["微信支付账单明细"],
    [
      "交易时间",
      "交易类型",
      "交易对方",
      "商品",
      "收/支",
      "金额(元)",
      "支付方式",
      "当前状态",
      "交易单号",
      "商户单号",
      "备注",
    ],
    [
      "2026-08-01 12:30:01",
      "商户消费",
      "示例餐厅",
      "午餐",
      "支出",
      "¥12.80",
      "零钱",
      "支付成功",
      "4200001",
      "M001",
      "",
    ],
  ];
}

function deterministicClock() {
  let tick = 0;
  return () => `2026-08-09T00:00:${String(tick++).padStart(2, "0")}.000Z`;
}

test("CSV decoding distinguishes UTF-8 BOM, plain UTF-8 and GB18030", async () => {
  const withBom = await parseCsvFile("fixtures/wechat-representative.csv");
  assert.equal(withBom.encoding, "utf-8");
  assert.equal(withBom.bom, true);

  const plainBytes = new TextEncoder().encode(
    "交易时间,金额(元),交易单号,收/支\n2026-08-01 00:00:00,1.00,plain-1,支出\n",
  );
  const plain = await parseCsvBytes(plainBytes);
  assert.equal(plain.encoding, "utf-8");
  assert.equal(plain.bom, false);

  const gb18030 = await parseCsvFile("fixtures/alipay-representative.csv");
  assert.equal(gb18030.encoding, "gb18030");
  assert.equal(gb18030.bom, false);

  result.encoding = {
    status: "PASS",
    detected: [withBom.encoding, plain.encoding, gb18030.encoding],
  };
});

test("representative WeChat CSV maps to normalized import records", async () => {
  const parsed = await parseCsvFile("fixtures/wechat-representative.csv");
  const prepared = prepareImportRows({
    rows: parsed.rows,
    profile: "wechat",
    extension: ".csv",
  });
  assert.equal(prepared.headerIndex, 2);
  assert.equal(prepared.records.length, 2);
  assert.equal(prepared.errors.length, 0);
  assert.equal(prepared.records[0].amountMinor, 1280);
  assert.equal(prepared.records[0].direction, "EXPENSE");
  assert.equal(prepared.records[1].direction, "INCOME");
  assert.equal(prepared.records[1].note, "");
  result.wechat = {
    status: "PASS",
    rowCount: prepared.records.length,
    headerIndex: prepared.headerIndex,
  };
});

test("representative Alipay CSV and XLSX produce equivalent identifiers and amounts", async () => {
  const csv = await parseCsvFile("fixtures/alipay-representative.csv");
  const csvPrepared = prepareImportRows({
    rows: csv.rows,
    profile: "alipay",
    extension: ".csv",
  });
  const xlsx = await parseXlsxFile("fixtures/alipay-representative.xlsx", {
    sheet: "账单",
  });
  const xlsxPrepared = prepareImportRows({
    rows: xlsx.rows,
    profile: "alipay",
    extension: ".xlsx",
  });

  assert.deepEqual(
    csvPrepared.records.map((row) => [row.sourceTransactionId, row.amountMinor]),
    xlsxPrepared.records.map((row) => [row.sourceTransactionId, row.amountMinor]),
  );
  assert.equal(xlsxPrepared.headerIndex, 1);
  result.alipay = {
    status: "PASS",
    csvEncoding: csv.encoding,
    xlsxRows: xlsxPrepared.records.length,
  };
});

test("preflight rejects unsupported, oversize, over-column and over-cell imports", () => {
  assert.throws(
    () =>
      preflightImport({
        sizeBytes: IMPORT_LIMITS.csv.maxUploadBytes + 1,
        extension: ".csv",
      }),
    (error) => assertImportError(error, "IMPORT_FILE_TOO_LARGE"),
  );
  assert.throws(
    () =>
      preflightImport({
        sizeBytes: 1,
        extension: ".xlsx",
        rows: IMPORT_LIMITS.xlsx.maxRows + 1,
      }),
    (error) => assertImportError(error, "IMPORT_ROW_LIMIT_EXCEEDED"),
  );
  assert.throws(
    () => preflightImport({ sizeBytes: 1, extension: ".xlsm" }),
    (error) => assertImportError(error, "IMPORT_TYPE_UNSUPPORTED"),
  );
  assert.throws(
    () =>
      preflightImport({
        sizeBytes: 1,
        extension: ".csv",
        columns: IMPORT_LIMITS.common.maxColumns + 1,
      }),
    (error) => assertImportError(error, "IMPORT_COLUMN_LIMIT_EXCEEDED"),
  );
  assert.throws(
    () =>
      preflightImport({
        sizeBytes: 1,
        extension: ".csv",
        maxCellCharacters: IMPORT_LIMITS.common.maxCellCharacters + 1,
      }),
    (error) => assertImportError(error, "IMPORT_CELL_TOO_LARGE"),
  );
  result.preflight = { status: "PASS", limits: IMPORT_LIMITS };
});

test("header discovery has deterministic missing, ambiguous and duplicate errors", () => {
  assert.throws(
    () => findHeader([["说明"]], ["交易时间", "金额(元)", "交易单号"]),
    (error) => assertImportError(error, "IMPORT_HEADER_NOT_FOUND"),
  );
  const header = ["交易时间", "金额(元)", "交易单号", "收/支"];
  assert.throws(
    () => findHeader([header, header], ["交易时间", "金额(元)", "交易单号"]),
    (error) => assertImportError(error, "IMPORT_HEADER_AMBIGUOUS"),
  );
  assert.throws(
    () =>
      findHeader(
        [["交易时间", "金额(元)", "交易单号", "交易单号", "收/支"]],
        ["交易时间", "金额(元)", "交易单号"],
      ),
    (error) => assertImportError(error, "IMPORT_HEADER_DUPLICATE_COLUMN"),
  );
  result.headers = { status: "PASS" };
});

test("atomic policy rejects malformed rows and performs no repository writes", async () => {
  const rows = wechatRows();
  rows.push([
    "2026-08-02 12:30:01",
    "商户消费",
    "重复商户",
    "重复",
    "支出",
    "2.00",
    "零钱",
    "支付成功",
    "4200001",
    "M002",
    "",
  ]);
  rows.push([
    "2026-08-03 12:30:01",
    "商户消费",
    "空编号",
    "测试",
    "支出",
    "3.00",
    "零钱",
    "支付成功",
    "",
    "M003",
    "",
  ]);
  rows.push([
    "2026-08-04 12:30:01",
    "商户消费",
    "错误金额",
    "测试",
    "支出",
    "12.345",
    "零钱",
    "支付成功",
    "4200004",
    "M004",
    "",
  ]);

  let writes = 0;
  const batch = await executeImportBatch({
    batchId: "atomic-1",
    fileName: "malformed.csv",
    rows,
    profile: "wechat",
    extension: ".csv",
    policy: IMPORT_POLICIES.atomic,
    clock: deterministicClock(),
    repository: {
      async writeImportedRecords() {
        writes += 1;
      },
    },
  });

  assert.equal(batch.state, IMPORT_BATCH_STATES.rejected);
  assert.equal(batch.recordsWritten, 0);
  assert.equal(writes, 0);
  assert.deepEqual(
    batch.errors.map((error) => error.code),
    [
      "IMPORT_DUPLICATE_TRANSACTION_ID",
      "IMPORT_REQUIRED_FIELD_BLANK",
      "IMPORT_AMOUNT_INVALID",
    ],
  );
  result.atomic = { status: "PASS", errorCount: batch.errors.length };
});

test("valid-rows policy writes only validated records through the repository interface", async () => {
  const rows = wechatRows();
  rows.push([
    "2026-08-02 12:30:01",
    "商户消费",
    "错误金额",
    "测试",
    "支出",
    "bad",
    "零钱",
    "支付成功",
    "4200002",
    "M002",
    "",
  ]);
  const calls = [];
  const batch = await executeImportBatch({
    batchId: "partial-1",
    fileName: "partial.csv",
    rows,
    profile: "wechat",
    extension: ".csv",
    policy: IMPORT_POLICIES.validRows,
    clock: deterministicClock(),
    repository: {
      async writeImportedRecords(payload) {
        calls.push(payload);
        return { recordsWritten: payload.records.length };
      },
    },
  });

  assert.equal(batch.state, IMPORT_BATCH_STATES.completedWithErrors);
  assert.equal(batch.recordsWritten, 1);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].records.length, 1);
  assert.equal(calls[0].records[0].sourceTransactionId, "4200001");
  assert.deepEqual(
    batch.history.map((entry) => entry.state),
    ["CREATED", "VALIDATING", "READY", "COMMITTING", "COMPLETED_WITH_ERRORS"],
  );
  result.partial = { status: "PASS", recordsWritten: batch.recordsWritten };
});

test("repository failure is isolated as a failed ImportBatch", async () => {
  const batch = await executeImportBatch({
    batchId: "write-failure-1",
    fileName: "valid.csv",
    rows: wechatRows(),
    profile: "wechat",
    extension: ".csv",
    clock: deterministicClock(),
    repository: {
      async writeImportedRecords() {
        throw new Error("database unavailable");
      },
    },
  });
  assert.equal(batch.state, IMPORT_BATCH_STATES.failed);
  assert.equal(batch.recordsWritten, 0);
  assert.equal(batch.errors[0].code, "IMPORT_REPOSITORY_WRITE_FAILED");
  result.repositoryFailure = { status: "PASS" };
});

test("unsupported CSV and workbook structures return stable error codes", async () => {
  await assert.rejects(
    () => parseCsvText('a,b\n"unterminated'),
    (error) => assertImportError(error, "IMPORT_CSV_PARSE_FAILED"),
  );
  assert.throws(
    () => validateWorkbookRows([]),
    (error) => assertImportError(error, "IMPORT_WORKBOOK_STRUCTURE_UNSUPPORTED"),
  );
  assert.ok(IMPORT_ERROR_MESSAGES_ZH_CN.IMPORT_WORKBOOK_STRUCTURE_UNSUPPORTED);
  result.structures = { status: "PASS" };
});

test("actual GB18030 fixture contains non-UTF-8 bytes", () => {
  const bytes = readFileSync("fixtures/alipay-representative.csv");
  assert.throws(() => new TextDecoder("utf-8", { fatal: true }).decode(bytes));
});

test.after(() => {
  writeFileSync(
    "results/04-import-correctness.json",
    JSON.stringify(result, null, 2),
  );
});
