import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const totalRows = 600;
const payload = "x".repeat(4096);

function startServer() {
  const server = createServer((request, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end("<!doctype html><meta charset='utf-8'><title>Stage 3 browser fault harness</title>");
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({
        server,
        origin: `http://127.0.0.1:${address.port}`,
      });
    });
  });
}

async function deleteDatabase(page, databaseName) {
  await page.evaluate(
    (name) =>
      new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase(name);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error("DELETE_DATABASE_BLOCKED"));
      }),
    databaseName,
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
  return page.evaluate(
    (name) =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open(name, 1);
        request.onerror = () => reject(request.error);
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
  );
}

async function runTerminationScenario({ context, origin, mode, triggerCount, run }) {
  const databaseName = `stage3-${mode}-${run}`;
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

  if (mode === "page-close") {
    await page.close({ runBeforeUnload: false });
  } else {
    const session = await context.newCDPSession(page);
    await session.send("Page.crash").catch(() => {});
    await page.waitForEvent("crash", { timeout: 5_000 }).catch(() => {});
    await page.close({ runBeforeUnload: false }).catch(() => {});
  }

  page = await context.newPage();
  await page.goto(origin);
  const persistedRows = await countRows(page, databaseName);
  assert.ok(
    persistedRows === 0 || persistedRows === totalRows,
    `${mode} left a partial transaction with ${persistedRows}/${totalRows} rows`,
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

try {
  for (let run = 0; run < 10; run += 1) {
    results.push(
      await runTerminationScenario({
        context,
        origin,
        mode: "page-close",
        triggerCount: 10,
        run,
      }),
    );
  }
  for (let run = 0; run < 10; run += 1) {
    results.push(
      await runTerminationScenario({
        context,
        origin,
        mode: "renderer-crash",
        triggerCount: 300,
        run,
      }),
    );
  }
} finally {
  await context.close();
  await browser.close();
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
  runs: results.length,
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
