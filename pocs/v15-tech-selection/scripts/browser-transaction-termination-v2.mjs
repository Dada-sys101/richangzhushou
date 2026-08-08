import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const totalRows = 600;
const payload = "x".repeat(4096);

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function withTimeout(promise, milliseconds, label) {
  return Promise.race([
    promise,
    delay(milliseconds).then(() => {
      throw new Error(`${label}_TIMEOUT_${milliseconds}MS`);
    }),
  ]);
}

function startServer() {
  const server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(
      "<!doctype html><meta charset='utf-8'><title>Stage 3 browser fault harness</title>",
    );
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({ server, origin: `http://127.0.0.1:${address.port}` });
    });
  });
}

async function deleteDatabase(page, databaseName) {
  await withTimeout(
    page.evaluate(
      (name) =>
        new Promise((resolve, reject) => {
          const request = indexedDB.deleteDatabase(name);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
          request.onblocked = () => reject(new Error("DELETE_DATABASE_BLOCKED"));
        }),
      databaseName,
    ),
    5_000,
    "DELETE_DATABASE",
  );
}

async function startSequentialTransaction(page, databaseName) {
  await page.evaluate(
    ({ name, total, rowPayload }) => {
      window.stage3Transaction = {
        successCount: 0,
        complete: false,
        aborted: false,
        error: null,
      };
      const openRequest = indexedDB.open(name, 1);
      openRequest.onupgradeneeded = () => {
        openRequest.result.createObjectStore("rows", { keyPath: "id" });
      };
      openRequest.onerror = () => {
        window.stage3Transaction.error = openRequest.error?.message ?? "OPEN_FAILED";
      };
      openRequest.onsuccess = () => {
        const database = openRequest.result;
        const transaction = database.transaction("rows", "readwrite");
        const store = transaction.objectStore("rows");
        let index = 0;
        transaction.oncomplete = () => {
          window.stage3Transaction.complete = true;
          database.close();
        };
        transaction.onabort = () => {
          window.stage3Transaction.aborted = true;
          window.stage3Transaction.error =
            transaction.error?.message ?? "TRANSACTION_ABORTED";
          database.close();
        };
        transaction.onerror = () => {
          window.stage3Transaction.error =
            transaction.error?.message ?? "TRANSACTION_ERROR";
        };
        const writeNext = () => {
          const request = store.put({ id: index, payload: rowPayload });
          request.onsuccess = () => {
            index += 1;
            window.stage3Transaction.successCount = index;
            if (index < total) writeNext();
          };
          request.onerror = () => {
            window.stage3Transaction.error = request.error?.message ?? "PUT_FAILED";
          };
        };
        writeNext();
      };
    },
    { name: databaseName, total: totalRows, rowPayload: payload },
  );
}

async function countRows(page, databaseName) {
  return withTimeout(
    page.evaluate(
      (name) =>
        new Promise((resolve, reject) => {
          const request = indexedDB.open(name, 1);
          request.onerror = () => reject(request.error);
          request.onblocked = () => reject(new Error("COUNT_DATABASE_BLOCKED"));
          request.onsuccess = () => {
            const database = request.result;
            if (!database.objectStoreNames.contains("rows")) {
              database.close();
              resolve(0);
              return;
            }
            const transaction = database.transaction("rows", "readonly");
            const countRequest = transaction.objectStore("rows").count();
            countRequest.onsuccess = () => resolve(countRequest.result);
            countRequest.onerror = () => reject(countRequest.error);
            transaction.oncomplete = () => database.close();
          };
        }),
      databaseName,
    ),
    8_000,
    "COUNT_ROWS",
  );
}

async function terminatePage(page, context, mode) {
  if (mode === "page-close") {
    await withTimeout(
      page.close({ runBeforeUnload: false }),
      3_000,
      "PAGE_CLOSE",
    );
    return;
  }

  const crashObserved = page.waitForEvent("crash").catch(() => null);
  const session = await context.newCDPSession(page);
  await Promise.race([
    session.send("Page.crash").catch(() => null),
    delay(1_500),
  ]);
  await Promise.race([crashObserved, delay(1_500)]);
  await Promise.race([
    page.close({ runBeforeUnload: false }).catch(() => null),
    delay(1_500),
  ]);
}

async function runScenario({ context, origin, mode, triggerCount, run }) {
  const databaseName = `stage3-${mode}-${triggerCount}-${run}`;
  let page = await context.newPage();
  await page.goto(origin);
  await deleteDatabase(page, databaseName);
  await startSequentialTransaction(page, databaseName);
  await page.waitForFunction(
    (count) => window.stage3Transaction?.successCount >= count,
    triggerCount,
    { timeout: 20_000 },
  );
  const observedBeforeTermination = await page.evaluate(
    () => window.stage3Transaction,
  );

  await terminatePage(page, context, mode);

  page = await context.newPage();
  await page.goto(origin);
  const persistedRows = await countRows(page, databaseName);
  assert.ok(
    persistedRows === 0 || persistedRows === totalRows,
    `${mode} at ${triggerCount} left ${persistedRows}/${totalRows} rows`,
  );
  await deleteDatabase(page, databaseName);
  await page.close();
  return {
    mode,
    run,
    triggerCount,
    observedBeforeTermination,
    persistedRows,
    atomicOutcome: persistedRows === 0 ? "ROLLED_BACK" : "FULLY_COMMITTED",
  };
}

const { server, origin } = await startServer();
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const results = [];
const cases = [
  { mode: "page-close", triggerCount: 10 },
  { mode: "page-close", triggerCount: 300 },
  { mode: "renderer-crash", triggerCount: 10 },
  { mode: "renderer-crash", triggerCount: 300 },
];

try {
  for (const testCase of cases) {
    for (let run = 0; run < 5; run += 1) {
      results.push(
        await withTimeout(
          runScenario({ context, origin, run, ...testCase }),
          35_000,
          `${testCase.mode}_${testCase.triggerCount}_${run}`,
        ),
      );
    }
  }
} finally {
  await context.close().catch(() => {});
  await browser.close().catch(() => {});
  await new Promise((resolve) => server.close(resolve));
}

const partialOutcomes = results.filter(
  (entry) => ![0, totalRows].includes(entry.persistedRows),
);
assert.equal(partialOutcomes.length, 0);

const summary = {
  environment: {
    browser: "Chromium via Playwright",
    totalRowsPerTransaction: totalRows,
    payloadBytesPerRow: payload.length,
  },
  cases: cases.length,
  runsPerCase: 5,
  totalRuns: results.length,
  pageCloseRuns: results.filter((entry) => entry.mode === "page-close").length,
  rendererCrashRuns: results.filter((entry) => entry.mode === "renderer-crash").length,
  rolledBack: results.filter((entry) => entry.atomicOutcome === "ROLLED_BACK").length,
  fullyCommitted: results.filter(
    (entry) => entry.atomicOutcome === "FULLY_COMMITTED",
  ).length,
  partialOutcomes: partialOutcomes.length,
  results,
};

mkdirSync("pocs/v15-tech-selection/results", { recursive: true });
writeFileSync(
  "pocs/v15-tech-selection/results/03-browser-transaction-termination.json",
  JSON.stringify(summary, null, 2),
);
console.log(JSON.stringify(summary, null, 2));
