# Stage 4 verification status

Status: CLOSED — AUTOMATED POC GATES PASSED (2026-08-09).

Scope: CSV/XLSX import PoC.

Implemented and accepted:

1. reusable import preflight, normalization and ImportBatch modules;
2. Node adapters for CSV and XLSX parsing;
3. UTF-8 BOM, plain UTF-8 and GB18030 decoding;
4. deterministic header discovery and mapping errors;
5. malformed-row, blank-required-field and duplicate-transaction detection;
6. atomic and valid-row partial-success policies;
7. repository/write-interface boundary with no direct IndexedDB v2 writes;
8. CSV streaming and XLSX memory-amplification gates;
9. localized zh-CN error-message catalog;
10. retained correctness and performance JSON evidence.

Final automated evidence:

- implementation commit: `7489523d1ed12535753c8ceca18fe37ff42397d1`;
- V1.5 Technology Selection PoC run: `31267847756`, conclusion `success`;
- full-repository CI run: `31267847766`, both `quality` and `browser-qa` concluded `success`;
- retained artifact: `9024696942` (`v15-tech-selection-poc-results`), SHA-256 digest `07fba49be132260507f783b75ffab932bf31dea302930f509c79deaa4c855da1`.

Correctness evidence:

- UTF-8 BOM, plain UTF-8 and GB18030 detection passed;
- representative WeChat CSV produced 2 valid normalized rows;
- representative Alipay CSV and XLSX produced equivalent identifiers and amounts;
- preflight, deterministic header errors, atomic rejection, valid-row partial success, repository failure isolation and unsupported-structure handling passed.

Performance evidence on the CI runner:

- CSV: 100,000 data rows, 7,260,129 bytes, streaming strategy, 470 ms, RSS increase 8.05 MiB, file-memory amplification 1.16x;
- XLSX: 100,000 data rows, 6,055,047 bytes, in-memory strategy, 7,842 ms, RSS increase 590.24 MiB, file-memory amplification 102.21x;
- therefore the release gates remain CSV <= 10 MiB / 100,000 rows and XLSX <= 5 MiB / 50,000 rows.

Accepted limitations:

- private or future WeChat/Alipay export variants are not claimed as validated without representative samples;
- this PoC does not authorize production import, merge to `main`, or direct writes to migration shadow stores;
- integration must implement the accepted repository interface and retain ImportBatch auditability.

Stage 5 may start.
