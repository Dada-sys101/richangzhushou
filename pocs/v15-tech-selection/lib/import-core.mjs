export const IMPORT_LIMITS = Object.freeze({
  csv: Object.freeze({ maxUploadBytes: 10 * 1024 * 1024, maxRows: 100_000 }),
  xlsx: Object.freeze({ maxUploadBytes: 5 * 1024 * 1024, maxRows: 50_000 }),
  common: Object.freeze({
    maxColumns: 64,
    maxCellCharacters: 64 * 1024,
    maxHeaderScanRows: 50,
  }),
});

export const IMPORT_BATCH_STATES = Object.freeze({
  created: "CREATED",
  validating: "VALIDATING",
  ready: "READY",
  committing: "COMMITTING",
  completed: "COMPLETED",
  completedWithErrors: "COMPLETED_WITH_ERRORS",
  rejected: "REJECTED",
  failed: "FAILED",
});

export const IMPORT_POLICIES = Object.freeze({
  atomic: "atomic",
  validRows: "valid-rows",
});

export class ImportError extends Error {
  constructor(code, details = {}, options = undefined) {
    super(code, options);
    this.name = "ImportError";
    this.code = code;
    this.details = details;
  }
}

function importError(code, details = {}, options = undefined) {
  return new ImportError(code, details, options);
}

function ensureNonNegativeSafeInteger(name, value) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw importError("IMPORT_METADATA_INVALID", { name, value });
  }
}

export function resolveImportType(extension) {
  const normalized = String(extension ?? "").trim().toLowerCase();
  if (normalized === ".csv") return "csv";
  if (normalized === ".xlsx") return "xlsx";
  throw importError("IMPORT_TYPE_UNSUPPORTED", { extension });
}

export function preflightImport({
  sizeBytes,
  extension,
  rows = 0,
  columns = 0,
  maxCellCharacters = 0,
}) {
  ensureNonNegativeSafeInteger("sizeBytes", sizeBytes);
  ensureNonNegativeSafeInteger("rows", rows);
  ensureNonNegativeSafeInteger("columns", columns);
  ensureNonNegativeSafeInteger("maxCellCharacters", maxCellCharacters);

  const type = resolveImportType(extension);
  const limits = IMPORT_LIMITS[type];
  if (sizeBytes > limits.maxUploadBytes) {
    throw importError("IMPORT_FILE_TOO_LARGE", {
      actual: sizeBytes,
      limit: limits.maxUploadBytes,
      type,
    });
  }
  if (rows > limits.maxRows) {
    throw importError("IMPORT_ROW_LIMIT_EXCEEDED", {
      actual: rows,
      limit: limits.maxRows,
      type,
    });
  }
  if (columns > IMPORT_LIMITS.common.maxColumns) {
    throw importError("IMPORT_COLUMN_LIMIT_EXCEEDED", {
      actual: columns,
      limit: IMPORT_LIMITS.common.maxColumns,
    });
  }
  if (maxCellCharacters > IMPORT_LIMITS.common.maxCellCharacters) {
    throw importError("IMPORT_CELL_TOO_LARGE", {
      actual: maxCellCharacters,
      limit: IMPORT_LIMITS.common.maxCellCharacters,
    });
  }
  return { accepted: true, type, limits };
}

function isUtf8Bom(bytes) {
  return bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
}

function isUtf16Bom(bytes) {
  return (
    bytes.length >= 2 &&
    ((bytes[0] === 0xff && bytes[1] === 0xfe) ||
      (bytes[0] === 0xfe && bytes[1] === 0xff))
  );
}

export function decodeCsvBytes(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (isUtf16Bom(bytes)) {
    throw importError("IMPORT_ENCODING_UNSUPPORTED", { detected: "utf-16" });
  }

  try {
    return {
      text: new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      encoding: "utf-8",
      bom: isUtf8Bom(bytes),
    };
  } catch (utf8Error) {
    try {
      return {
        text: new TextDecoder("gb18030", { fatal: true }).decode(bytes),
        encoding: "gb18030",
        bom: false,
      };
    } catch (gb18030Error) {
      throw importError(
        "IMPORT_ENCODING_UNSUPPORTED",
        { attempted: ["utf-8", "gb18030"] },
        { cause: gb18030Error ?? utf8Error },
      );
    }
  }
}

export function normalizeHeaderName(value) {
  return String(value ?? "")
    .replace(/^\uFEFF/u, "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/gu, " ");
}

export function measureRows(rows) {
  if (!Array.isArray(rows)) {
    throw importError("IMPORT_WORKBOOK_STRUCTURE_UNSUPPORTED", {
      reason: "ROWS_NOT_ARRAY",
    });
  }
  let columns = 0;
  let maxCellCharacters = 0;
  for (const row of rows) {
    if (!Array.isArray(row)) {
      throw importError("IMPORT_WORKBOOK_STRUCTURE_UNSUPPORTED", {
        reason: "ROW_NOT_ARRAY",
      });
    }
    columns = Math.max(columns, row.length);
    for (const cell of row) {
      const length = String(cell ?? "").length;
      maxCellCharacters = Math.max(maxCellCharacters, length);
    }
  }
  return { rows: rows.length, columns, maxCellCharacters };
}

function normalizedHeader(row) {
  return row.map(normalizeHeaderName);
}

export function findHeader(rows, requiredHeaders, options = {}) {
  const maxScanRows = options.maxScanRows ?? IMPORT_LIMITS.common.maxHeaderScanRows;
  const required = requiredHeaders.map(normalizeHeaderName);
  const candidates = [];
  for (let index = 0; index < Math.min(rows.length, maxScanRows); index += 1) {
    const header = normalizedHeader(rows[index]);
    if (required.every((name) => header.includes(name))) {
      candidates.push({ headerIndex: index, header });
    }
  }
  if (candidates.length === 0) {
    throw importError("IMPORT_HEADER_NOT_FOUND", { required });
  }
  if (candidates.length > 1) {
    throw importError("IMPORT_HEADER_AMBIGUOUS", {
      headerIndexes: candidates.map((candidate) => candidate.headerIndex),
    });
  }

  const candidate = candidates[0];
  const duplicates = candidate.header.filter(
    (name, index, all) => name !== "" && all.indexOf(name) !== index,
  );
  if (duplicates.length > 0) {
    throw importError("IMPORT_HEADER_DUPLICATE_COLUMN", {
      columns: [...new Set(duplicates)],
    });
  }
  return {
    ...candidate,
    data: rows.slice(candidate.headerIndex + 1),
  };
}

const WECHAT_PROFILE = Object.freeze({
  id: "WECHAT",
  extension: ".csv",
  requiredHeaders: ["交易时间", "金额(元)", "交易单号"],
  fields: Object.freeze({
    transactionId: ["交易单号"],
    occurredAt: ["交易时间"],
    amount: ["金额(元)"],
    direction: ["收/支"],
    counterparty: ["交易对方"],
    description: ["商品"],
    status: ["当前状态"],
    merchantOrderId: ["商户单号"],
    note: ["备注"],
  }),
});

const ALIPAY_PROFILE = Object.freeze({
  id: "ALIPAY",
  extension: ".xlsx",
  requiredHeaders: ["交易号", "金额(元)", "交易状态"],
  fields: Object.freeze({
    transactionId: ["交易号"],
    occurredAt: ["交易创建时间", "付款时间"],
    amount: ["金额(元)"],
    direction: ["收/支"],
    counterparty: ["交易对方"],
    description: ["商品名称"],
    status: ["交易状态"],
    merchantOrderId: ["商家订单号"],
    note: ["备注"],
  }),
});

export const IMPORT_PROFILES = Object.freeze({
  wechat: WECHAT_PROFILE,
  alipay: ALIPAY_PROFILE,
});

function profileFor(profile) {
  if (typeof profile === "string" && IMPORT_PROFILES[profile]) {
    return IMPORT_PROFILES[profile];
  }
  if (profile?.id && profile?.fields && profile?.requiredHeaders) return profile;
  throw importError("IMPORT_PROFILE_UNSUPPORTED", { profile });
}

function buildHeaderMap(header, profile) {
  const map = {};
  for (const [field, aliases] of Object.entries(profile.fields)) {
    const normalizedAliases = aliases.map(normalizeHeaderName);
    const index = header.findIndex((name) => normalizedAliases.includes(name));
    map[field] = index;
  }
  return map;
}

function blank(value) {
  return value === null || value === undefined || String(value).trim() === "";
}

function rowValue(row, index) {
  return index < 0 ? null : row[index] ?? null;
}

function parseAmountMinor(value) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/[¥￥,\s]/gu, "");
  if (!/^-?\d+(?:\.\d{1,2})?$/u.test(normalized)) {
    throw importError("IMPORT_AMOUNT_INVALID", { value });
  }
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0) {
    throw importError("IMPORT_AMOUNT_INVALID", { value });
  }
  return Math.round(amount * 100);
}

function normalizeDirection(value) {
  const normalized = normalizeHeaderName(value);
  if (normalized === "支出") return "EXPENSE";
  if (normalized === "收入") return "INCOME";
  if (["不计收支", "其他"].includes(normalized)) return "NEUTRAL";
  throw importError("IMPORT_DIRECTION_INVALID", { value });
}

function rawObject(header, row) {
  return Object.fromEntries(
    header.map((name, index) => [name || `column_${index + 1}`, row[index] ?? null]),
  );
}

function rowError(error, rowNumber) {
  if (error instanceof ImportError) {
    return { code: error.code, rowNumber, details: error.details };
  }
  return {
    code: "IMPORT_ROW_INVALID",
    rowNumber,
    details: { message: error instanceof Error ? error.message : String(error) },
  };
}

export function prepareImportRows({ rows, profile, extension }) {
  const selectedProfile = profileFor(profile);
  const type = resolveImportType(extension ?? selectedProfile.extension);
  const measured = measureRows(rows);
  if (measured.columns > IMPORT_LIMITS.common.maxColumns) {
    throw importError("IMPORT_COLUMN_LIMIT_EXCEEDED", measured);
  }
  if (measured.maxCellCharacters > IMPORT_LIMITS.common.maxCellCharacters) {
    throw importError("IMPORT_CELL_TOO_LARGE", measured);
  }

  const table = findHeader(rows, selectedProfile.requiredHeaders);
  const dataRows = table.data.filter((row) => row.some((cell) => !blank(cell)));
  if (dataRows.length > IMPORT_LIMITS[type].maxRows) {
    throw importError("IMPORT_ROW_LIMIT_EXCEEDED", {
      actual: dataRows.length,
      limit: IMPORT_LIMITS[type].maxRows,
      type,
    });
  }

  const headerMap = buildHeaderMap(table.header, selectedProfile);
  const requiredFields = ["transactionId", "occurredAt", "amount", "direction"];
  const missingColumns = requiredFields.filter((field) => headerMap[field] < 0);
  if (missingColumns.length > 0) {
    throw importError("IMPORT_REQUIRED_COLUMN_MISSING", { fields: missingColumns });
  }

  const records = [];
  const errors = [];
  const seenIds = new Set();
  for (let index = 0; index < dataRows.length; index += 1) {
    const row = dataRows[index];
    const rowNumber = table.headerIndex + index + 2;
    try {
      if (row.length > IMPORT_LIMITS.common.maxColumns) {
        throw importError("IMPORT_COLUMN_LIMIT_EXCEEDED", {
          actual: row.length,
          limit: IMPORT_LIMITS.common.maxColumns,
        });
      }
      const transactionId = String(rowValue(row, headerMap.transactionId) ?? "").trim();
      const occurredAt = String(rowValue(row, headerMap.occurredAt) ?? "").trim();
      const amountValue = rowValue(row, headerMap.amount);
      const directionValue = rowValue(row, headerMap.direction);
      const blankFields = [];
      if (blank(transactionId)) blankFields.push("transactionId");
      if (blank(occurredAt)) blankFields.push("occurredAt");
      if (blank(amountValue)) blankFields.push("amount");
      if (blank(directionValue)) blankFields.push("direction");
      if (blankFields.length > 0) {
        throw importError("IMPORT_REQUIRED_FIELD_BLANK", { fields: blankFields });
      }
      if (seenIds.has(transactionId)) {
        throw importError("IMPORT_DUPLICATE_TRANSACTION_ID", { transactionId });
      }
      seenIds.add(transactionId);

      records.push({
        source: selectedProfile.id,
        sourceTransactionId: transactionId,
        merchantOrderId: String(
          rowValue(row, headerMap.merchantOrderId) ?? "",
        ).trim(),
        occurredAt,
        amountMinor: parseAmountMinor(amountValue),
        currency: "CNY",
        direction: normalizeDirection(directionValue),
        counterparty: String(rowValue(row, headerMap.counterparty) ?? "").trim(),
        description: String(rowValue(row, headerMap.description) ?? "").trim(),
        sourceStatus: String(rowValue(row, headerMap.status) ?? "").trim(),
        note: String(rowValue(row, headerMap.note) ?? "").trim(),
        sourceRowNumber: rowNumber,
        raw: rawObject(table.header, row),
      });
    } catch (error) {
      errors.push(rowError(error, rowNumber));
    }
  }

  return {
    profile: selectedProfile.id,
    type,
    headerIndex: table.headerIndex,
    header: table.header,
    records,
    errors,
    totalDataRows: dataRows.length,
  };
}

function stateEntry(state, clock) {
  return { state, at: clock() };
}

export async function executeImportBatch({
  batchId,
  fileName,
  rows,
  profile,
  extension,
  repository,
  policy = IMPORT_POLICIES.atomic,
  clock = () => new Date().toISOString(),
}) {
  if (!batchId || !fileName) {
    throw importError("IMPORT_BATCH_METADATA_INVALID", { batchId, fileName });
  }
  if (!Object.values(IMPORT_POLICIES).includes(policy)) {
    throw importError("IMPORT_POLICY_UNSUPPORTED", { policy });
  }
  if (!repository || typeof repository.writeImportedRecords !== "function") {
    throw importError("IMPORT_REPOSITORY_REQUIRED");
  }

  const history = [stateEntry(IMPORT_BATCH_STATES.created, clock)];
  history.push(stateEntry(IMPORT_BATCH_STATES.validating, clock));
  let prepared;
  try {
    prepared = prepareImportRows({ rows, profile, extension });
  } catch (error) {
    history.push(stateEntry(IMPORT_BATCH_STATES.rejected, clock));
    return {
      batchId,
      fileName,
      state: IMPORT_BATCH_STATES.rejected,
      history,
      recordsWritten: 0,
      errors: [rowError(error, null)],
    };
  }

  if (prepared.errors.length > 0 && policy === IMPORT_POLICIES.atomic) {
    history.push(stateEntry(IMPORT_BATCH_STATES.rejected, clock));
    return {
      batchId,
      fileName,
      state: IMPORT_BATCH_STATES.rejected,
      history,
      recordsWritten: 0,
      errors: prepared.errors,
      prepared,
    };
  }
  if (prepared.records.length === 0) {
    history.push(stateEntry(IMPORT_BATCH_STATES.rejected, clock));
    return {
      batchId,
      fileName,
      state: IMPORT_BATCH_STATES.rejected,
      history,
      recordsWritten: 0,
      errors: prepared.errors.length
        ? prepared.errors
        : [{ code: "IMPORT_NO_VALID_ROWS", rowNumber: null, details: {} }],
      prepared,
    };
  }

  history.push(stateEntry(IMPORT_BATCH_STATES.ready, clock));
  history.push(stateEntry(IMPORT_BATCH_STATES.committing, clock));
  try {
    const writeResult = await repository.writeImportedRecords({
      batchId,
      fileName,
      source: prepared.profile,
      records: prepared.records,
    });
    const recordsWritten =
      writeResult?.recordsWritten ?? writeResult?.inserted ?? prepared.records.length;
    const state =
      prepared.errors.length > 0
        ? IMPORT_BATCH_STATES.completedWithErrors
        : IMPORT_BATCH_STATES.completed;
    history.push(stateEntry(state, clock));
    return {
      batchId,
      fileName,
      state,
      history,
      recordsWritten,
      errors: prepared.errors,
      prepared,
      writeResult: writeResult ?? null,
    };
  } catch (error) {
    history.push(stateEntry(IMPORT_BATCH_STATES.failed, clock));
    return {
      batchId,
      fileName,
      state: IMPORT_BATCH_STATES.failed,
      history,
      recordsWritten: 0,
      errors: [
        {
          code: "IMPORT_REPOSITORY_WRITE_FAILED",
          rowNumber: null,
          details: {
            message: error instanceof Error ? error.message : String(error),
          },
        },
      ],
      prepared,
    };
  }
}

export const IMPORT_ERROR_MESSAGES_ZH_CN = Object.freeze({
  IMPORT_TYPE_UNSUPPORTED: "仅支持 CSV 和 XLSX 文件",
  IMPORT_FILE_TOO_LARGE: "文件超过允许大小",
  IMPORT_ROW_LIMIT_EXCEEDED: "数据行数超过允许上限",
  IMPORT_COLUMN_LIMIT_EXCEEDED: "列数超过允许上限",
  IMPORT_CELL_TOO_LARGE: "单元格内容超过允许上限",
  IMPORT_ENCODING_UNSUPPORTED: "文件编码不受支持",
  IMPORT_HEADER_NOT_FOUND: "未找到可识别的账单表头",
  IMPORT_HEADER_AMBIGUOUS: "检测到多个可能的账单表头",
  IMPORT_HEADER_DUPLICATE_COLUMN: "账单表头包含重复列",
  IMPORT_REQUIRED_COLUMN_MISSING: "账单缺少必需列",
  IMPORT_REQUIRED_FIELD_BLANK: "数据行缺少必填内容",
  IMPORT_AMOUNT_INVALID: "金额格式不正确",
  IMPORT_DIRECTION_INVALID: "收支方向无法识别",
  IMPORT_DUPLICATE_TRANSACTION_ID: "账单内存在重复交易编号",
  IMPORT_REPOSITORY_WRITE_FAILED: "写入账本失败，请稍后重试",
  IMPORT_WORKBOOK_STRUCTURE_UNSUPPORTED: "工作簿结构不受支持",
});
