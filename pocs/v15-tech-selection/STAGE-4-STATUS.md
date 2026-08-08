# Stage 4 verification status

Status: IN PROGRESS.

Scope: CSV/XLSX import PoC.

Existing baseline:

- representative WeChat CSV parsing;
- representative Alipay CSV parsing with an explicit GB18030 adapter boundary;
- representative Alipay XLSX parsing with merged title row and blank cells;
- preliminary file-size, row-count, column-count and cell-size limits;
- 100k-row CSV/XLSX benchmark scripts.

Stage 4 completion gates:

1. extract reusable import preflight and parser modules from test-only code;
2. verify UTF-8 BOM, plain UTF-8 and GB18030 decoding behavior;
3. define deterministic header discovery and field mapping errors;
4. validate malformed rows, duplicate transaction identifiers, blank required fields and unsupported workbook structures;
5. validate CSV streaming limits and XLSX memory amplification;
6. define ImportBatch states, localized error codes and partial-failure policy;
7. ensure imported records enter through a repository/write interface rather than writing directly to IndexedDB v2 stores;
8. run the Stage 4 test and benchmark gates and retain result artifacts.

Restrictions:

- do not merge into `main` during the isolated PoC;
- do not treat private WeChat/Alipay export formats as fully validated without supplied samples;
- do not write imported data directly into migration shadow stores.
