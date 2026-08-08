import assert from "node:assert/strict";
import { createReadStream, mkdirSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const root = resolve("pocs/v15-tech-selection");
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

function startServer() {
  const server = createServer((request, response) => {
    const pathname = new URL(request.url, "http://127.0.0.1").pathname;
    if (pathname === "/") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end("<!doctype html><meta charset='utf-8'><title>Web Locks harness</title>");
      return;
    }
    const relative = normalize(decodeURIComponent(pathname)).replace(/^[/\\]+/u, "");
    const filePath = join(root, relative);
    if (!filePath.startsWith(root)) {
      response.writeHead(403).end();
      return;
    }
    try {
      if (!statSync(filePath).isFile()) throw new Error("NOT_FILE");
      response.writeHead(200, {
        "content-type": contentTypes[extname(filePath)] ?? "application/octet-stream",
        "cache-control": "no-store",
      });
      createReadStream(filePath).pipe(response);
    } catch {
      response.writeHead(404).end();
    }
  });
  return new Promise((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolvePromise({
        server,
        origin: `http://127.0.0.1:${address.port}`,
      });
    });
  });
}

async function seed(page, databaseName) {
  await page.evaluate(async (name) => {
    const module = await import("/lib/indexeddb-migration.mjs");
    await new Promise((resolvePromise, reject) => {
      const request = indexedDB.deleteDatabase(name);
      request.onsuccess = () => resolvePromise();
      request.onerror = () => reject(request.error);
    });
    const database = await module.openV1Database(indexedDB, name);
    const transaction = database.transaction(
      [module.STORES.kv, module.STORES.entitiesV1, module.STORES.pendingV1],
      "readwrite",
    );
    transaction.objectStore(module.STORES.kv).put({
      key: "activeSchema",
      value: "v1",
    });
    for (let index = 0; index < 12; index += 1) {
      transaction.objectStore(module.STORES.entitiesV1).put({
        userId: index < 8 ? "user-a" : "user-b",
        entityType: index % 2 === 0 ? "TASK" : "REMINDER",
        id: `entity-${index}`,
        data: { title: `锁测试-${index}`, nested: { b: index, a: true } },
        pending: false,
        updatedAt: new Date(Date.UTC(2026, 7, 8, 2, index)).toISOString(),
      });
    }
    for (let index = 0; index < 4; index += 1) {
      transaction.objectStore(module.STORES.pendingV1).put({
        id: `mutation-${index}`,
        userId: index < 3 ? "user-a" : "user-b",
        entityType: "TASK",
        action: "CREATE",
        entityId: null,
        localId: `local-${index}`,
        payload: { title: `待同步-${index}` },
        version: null,
        status: "PENDING",
        errorCode: null,
        errorMessage: null,
        current: null,
        createdAt: Date.now() + index,
      });
    }
    await new Promise((resolvePromise, reject) => {
      transaction.oncomplete = () => resolvePromise();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    database.close();
  }, databaseName);
}

async function runCaller(page, databaseName, callerId, evidenceKey) {
  return page.evaluate(
    async ({ name, id, key }) => {
      const module = await import("/lib/indexeddb-migration.mjs");
      return module.migrateV1ToV2({
        indexedDB,
        cryptoProvider: crypto,
        databaseName: name,
        deviceId: "browser-web-lock",
        batchSize: 2,
        beforeMigration: async () => {
          const enteredAt = performance.timeOrigin + performance.now();
          const entries = JSON.parse(localStorage.getItem(key) ?? "[]");
          entries.push({ callerId: id, enteredAt, exitedAt: null });
          localStorage.setItem(key, JSON.stringify(entries));
          await new Promise((resolvePromise) => setTimeout(resolvePromise, 120));
          const updated = JSON.parse(localStorage.getItem(key) ?? "[]");
          const entry = updated.find((candidate) => candidate.callerId === id);
          entry.exitedAt = performance.timeOrigin + performance.now();
          localStorage.setItem(key, JSON.stringify(updated));
        },
      });
    },
    { name: databaseName, id: callerId, key: evidenceKey },
  );
}

async function deleteDatabase(page, databaseName) {
  await page.evaluate(
    (name) =>
      new Promise((resolvePromise, reject) => {
        const request = indexedDB.deleteDatabase(name);
        request.onsuccess = () => resolvePromise();
        request.onerror = () => reject(request.error);
      }),
    databaseName,
  );
}

const { server, origin } = await startServer();
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const firstPage = await context.newPage();
const secondPage = await context.newPage();
await Promise.all([firstPage.goto(origin), secondPage.goto(origin)]);

const supported = await firstPage.evaluate(() => Boolean(navigator.locks?.request));
assert.equal(supported, true, "Chromium Web Locks API must be available");

const runs = [];
try {
  for (let run = 0; run < 10; run += 1) {
    const databaseName = `stage3-browser-lock-${run}`;
    const evidenceKey = `stage3-lock-evidence-${run}`;
    await seed(firstPage, databaseName);
    await firstPage.evaluate((key) => localStorage.removeItem(key), evidenceKey);

    const [first, second] = await Promise.all([
      runCaller(firstPage, databaseName, `caller-a-${run}`, evidenceKey),
      runCaller(secondPage, databaseName, `caller-b-${run}`, evidenceKey),
    ]);
    const entries = await firstPage.evaluate(
      (key) => JSON.parse(localStorage.getItem(key) ?? "[]"),
      evidenceKey,
    );
    assert.equal(entries.length, 2);
    entries.sort((left, right) => left.enteredAt - right.enteredAt);
    assert.ok(entries[0].exitedAt !== null);
    assert.ok(entries[1].enteredAt >= entries[0].exitedAt);
    const statuses = [first.status, second.status].sort();
    assert.deepEqual(statuses, ["ALREADY_ACTIVE", "COMPLETED"]);

    const state = await firstPage.evaluate(async (name) => {
      const module = await import("/lib/indexeddb-migration.mjs");
      const snapshot = await module.inspectMigrationState({
        indexedDB,
        databaseName: name,
      });
      return {
        activeSchema: snapshot.activeSchema,
        entityCount: snapshot.targetEntities.length,
        pendingCount: snapshot.targetPending.length,
      };
    }, databaseName);
    assert.deepEqual(state, {
      activeSchema: "v2",
      entityCount: 12,
      pendingCount: 4,
    });
    runs.push({ run, statuses, entries, state, overlap: false });
    await deleteDatabase(firstPage, databaseName);
  }
} finally {
  await context.close();
  await browser.close();
  await new Promise((resolvePromise) => server.close(resolvePromise));
}

const summary = {
  browser: "Chromium via Playwright",
  webLocksSupported: supported,
  runs: runs.length,
  overlappingLockEntries: runs.filter((entry) => entry.overlap).length,
  completedAndAlreadyActivePairs: runs.filter(
    (entry) =>
      entry.statuses[0] === "ALREADY_ACTIVE" &&
      entry.statuses[1] === "COMPLETED",
  ).length,
  results: runs,
};
assert.equal(summary.overlappingLockEntries, 0);
assert.equal(summary.completedAndAlreadyActivePairs, 10);

mkdirSync("pocs/v15-tech-selection/results", { recursive: true });
writeFileSync(
  "pocs/v15-tech-selection/results/03-browser-web-locks.json",
  JSON.stringify(summary, null, 2),
);
console.log(JSON.stringify(summary, null, 2));
