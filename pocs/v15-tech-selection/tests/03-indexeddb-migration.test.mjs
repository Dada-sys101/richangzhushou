import "fake-indexeddb/auto";
import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";

mkdirSync("results", { recursive: true });

function request(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onabort = () => reject(tx.error ?? new Error("TX_ABORTED"));
    tx.onerror = () => reject(tx.error);
  });
}

async function deleteDatabase(name) {
  await request(indexedDB.deleteDatabase(name));
}

async function createV1(name) {
  const open = indexedDB.open(name, 1);
  open.onupgradeneeded = () => {
    const db = open.result;
    db.createObjectStore("kv", { keyPath: "key" });
    db.createObjectStore("entities", {
      keyPath: ["userId", "entityType", "id"],
    });
    db.createObjectStore("pending", { keyPath: "id" });
  };
  const db = await request(open);
  const tx = db.transaction(["kv", "entities"], "readwrite");
  tx.objectStore("kv").put({ key: "activeSchema", value: "v1" });
  for (let index = 0; index < 20; index += 1) {
    tx.objectStore("entities").put({
      userId: "u1",
      entityType: index % 2 === 0 ? "TASK" : "REMINDER",
      id: `e-${index}`,
      data: { title: `item-${index}` },
      updatedAt: new Date(2026, 0, index + 1).toISOString(),
    });
  }
  await transactionDone(tx);
  db.close();
}

async function upgradeSchema(name) {
  const open = indexedDB.open(name, 2);
  open.onupgradeneeded = () => {
    const db = open.result;
    if (!db.objectStoreNames.contains("v2_entities")) {
      db.createObjectStore("v2_entities", {
        keyPath: ["userId", "entityType", "id"],
      });
      db.createObjectStore("local_capture_drafts", {
        keyPath: ["userId", "id"],
      });
      db.createObjectStore("crypto_keys", { keyPath: ["userId", "keyId"] });
      db.createObjectStore("migration_journal", { keyPath: "id" });
    }
  };
  const db = await request(open);
  db.close();
}

async function readAll(db, storeName) {
  const tx = db.transaction(storeName, "readonly");
  const rows = await request(tx.objectStore(storeName).getAll());
  await transactionDone(tx);
  return rows;
}

async function migrate(name, { failAfter = Number.POSITIVE_INFINITY } = {}) {
  const db = await request(indexedDB.open(name, 2));
  const source = await readAll(db, "entities");
  try {
    for (let index = 0; index < source.length; index += 1) {
      if (index === failAfter) throw new Error("INJECTED_MIGRATION_FAILURE");
      const tx = db.transaction(
        ["v2_entities", "migration_journal"],
        "readwrite",
      );
      tx.objectStore("v2_entities").put({
        ...source[index],
        data: { ...source[index].data, schemaVersion: 2 },
      });
      tx.objectStore("migration_journal").put({
        id: `copy-${index}`,
        status: "COPIED",
      });
      await transactionDone(tx);
    }
    const tx = db.transaction(["kv", "migration_journal"], "readwrite");
    tx.objectStore("kv").put({ key: "activeSchema", value: "v2" });
    tx.objectStore("migration_journal").put({
      id: "activation",
      status: "ACTIVE",
    });
    await transactionDone(tx);
    return { status: "COMPLETED" };
  } catch (error) {
    const cleanup = db.transaction(
      ["v2_entities", "migration_journal", "kv"],
      "readwrite",
    );
    cleanup.objectStore("v2_entities").clear();
    cleanup.objectStore("migration_journal").clear();
    cleanup.objectStore("kv").put({ key: "activeSchema", value: "v1" });
    await transactionDone(cleanup);
    return { status: "ROLLED_BACK", error: error.message };
  } finally {
    db.close();
  }
}

async function snapshot(name) {
  const db = await request(indexedDB.open(name, 2));
  const entities = await readAll(db, "entities");
  const v2 = await readAll(db, "v2_entities");
  const tx = db.transaction("kv", "readonly");
  const active = await request(tx.objectStore("kv").get("activeSchema"));
  await transactionDone(tx);
  db.close();
  return { entities, v2, activeSchema: active.value };
}

const result = {};

test("v1 to v2 succeeds through shadow copy and atomic activation", async () => {
  const name = "daily-assistant-poc-success";
  await deleteDatabase(name);
  await createV1(name);
  await upgradeSchema(name);
  assert.deepEqual(await migrate(name), { status: "COMPLETED" });
  const state = await snapshot(name);
  assert.equal(state.entities.length, 20);
  assert.equal(state.v2.length, 20);
  assert.equal(state.activeSchema, "v2");
  result.success = {
    status: "PASS",
    sourceRows: 20,
    targetRows: 20,
    activeSchema: "v2",
  };
});

test("injected failure rolls back fully to v1 without data loss", async () => {
  const name = "daily-assistant-poc-failure";
  await deleteDatabase(name);
  await createV1(name);
  await upgradeSchema(name);
  const before = await snapshot(name);
  const migration = await migrate(name, { failAfter: 7 });
  const after = await snapshot(name);
  assert.equal(migration.status, "ROLLED_BACK");
  assert.deepEqual(after.entities, before.entities);
  assert.equal(after.v2.length, 0);
  assert.equal(after.activeSchema, "v1");
  result.rollback = {
    status: "PASS",
    injectedAtRow: 7,
    sourceRowsBefore: before.entities.length,
    sourceRowsAfter: after.entities.length,
    targetRowsAfter: after.v2.length,
    activeSchema: after.activeSchema,
  };
});

test.after(() => {
  writeFileSync(
    "results/03-indexeddb-migration.json",
    JSON.stringify(result, null, 2),
  );
});
