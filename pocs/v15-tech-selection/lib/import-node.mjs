import { readFile, stat } from "node:fs/promises";
import { parse } from "csv-parse";
import { readSheet } from "read-excel-file/node";
import {
  IMPORT_LIMITS,
  ImportError,
  decodeCsvBytes,
  measureRows,
  preflightImport,
  resolveImportType,
} from "./import-core.mjs";

function wrapParserError(code, error, details = {}) {
  if (error instanceof ImportError) return error;
  return new ImportError(
    code,
    {
      ...details,
      message: error instanceof Error ? error.message : String(error),
    },
    { cause: error },
  );
}

export function parseCsvText(text) {
  return new Promise((resolve, reject) => {
    parse(
      text,
      {
        bom: true,
        relax_column_count: true,
        skip_empty_lines: true,
        trim: true,
        max_record_size:
          IMPORT_LIMITS.common.maxCellCharacters *
          IMPORT_LIMITS.common.maxColumns,
      },
      (error, rows) => {
        if (error) {
          reject(wrapParserError("IMPORT_CSV_PARSE_FAILED", error));
          return;
        }
        resolve(rows);
      },
    );
  });
}

function assertRawParsedLimits(rows, type) {
  const measured = measureRows(rows);
  if (
    measured.rows >
    IMPORT_LIMITS[type].maxRows + IMPORT_LIMITS.common.maxHeaderScanRows
  ) {
    throw new ImportError("IMPORT_ROW_LIMIT_EXCEEDED", {
      actual: measured.rows,
      limit:
        IMPORT_LIMITS[type].maxRows + IMPORT_LIMITS.common.maxHeaderScanRows,
      type,
      boundary: "raw-rows-before-header-discovery",
    });
  }
  preflightImport({
    sizeBytes: 0,
    extension: `.${type}`,
    columns: measured.columns,
    maxCellCharacters: measured.maxCellCharacters,
  });
  return measured;
}

export async function parseCsvBytes(bytes) {
  const decoded = decodeCsvBytes(bytes);
  const rows = await parseCsvText(decoded.text);
  const measured = assertRawParsedLimits(rows, "csv");
  return { ...decoded, rows, measured };
}

export async function parseCsvFile(path) {
  const metadata = await stat(path);
  preflightImport({ sizeBytes: metadata.size, extension: ".csv" });
  const bytes = await readFile(path);
  const parsed = await parseCsvBytes(bytes);
  return { ...parsed, sizeBytes: metadata.size, type: "csv" };
}

export function validateWorkbookRows(rows) {
  const measured = measureRows(rows);
  if (measured.rows === 0 || measured.columns === 0) {
    throw new ImportError("IMPORT_WORKBOOK_STRUCTURE_UNSUPPORTED", {
      reason: "EMPTY_WORKSHEET",
    });
  }
  assertRawParsedLimits(rows, "xlsx");
  return measured;
}

export async function parseXlsxFile(path, options = {}) {
  const metadata = await stat(path);
  preflightImport({ sizeBytes: metadata.size, extension: ".xlsx" });
  let rows;
  try {
    rows = await readSheet(path, options.sheet ?? 1);
  } catch (error) {
    throw wrapParserError("IMPORT_XLSX_PARSE_FAILED", error, {
      sheet: options.sheet ?? 1,
    });
  }
  const measured = validateWorkbookRows(rows);
  return {
    rows,
    measured,
    sizeBytes: metadata.size,
    type: resolveImportType(".xlsx"),
    sheet: options.sheet ?? 1,
  };
}
