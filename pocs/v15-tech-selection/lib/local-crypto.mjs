const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function assertNonEmpty(name, value) {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
}

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

function base64UrlToBytes(value) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionComplete(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function deleteIndexRows(index, query) {
  return new Promise((resolve, reject) => {
    const request = index.openCursor(query);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve();
        return;
      }
      cursor.delete();
      cursor.continue();
    };
    request.onerror = () => reject(request.error);
  });
}

export function buildKeyId(userId, deviceId, keyVersion = 1) {
  assertNonEmpty("userId", userId);
  assertNonEmpty("deviceId", deviceId);
  if (!Number.isSafeInteger(keyVersion) || keyVersion < 1) {
    throw new TypeError("keyVersion must be a positive safe integer");
  }
  return [
    "daily-assistant-key",
    encodeURIComponent(userId),
    encodeURIComponent(deviceId),
    `v${keyVersion}`,
  ].join(":");
}

export function buildAdditionalData({
  userId,
  keyId,
  recordType,
  recordId,
  schemeVersion = 1,
}) {
  assertNonEmpty("userId", userId);
  assertNonEmpty("keyId", keyId);
  assertNonEmpty("recordType", recordType);
  assertNonEmpty("recordId", recordId);
  return textEncoder.encode(
    JSON.stringify({
      app: "daily-assistant",
      schemeVersion,
      userId,
      keyId,
      recordType,
      recordId,
    }),
  );
}

export async function generateDeviceKey(cryptoProvider) {
  return cryptoProvider.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export function assertSupportedDeviceKey(key) {
  if (
    key?.type !== "secret" ||
    key.extractable !== false ||
    key.algorithm?.name !== "AES-GCM" ||
    key.algorithm?.length !== 256 ||
    !key.usages.includes("encrypt") ||
    !key.usages.includes("decrypt")
  ) {
    throw new Error("UNSUPPORTED_LOCAL_DEVICE_KEY");
  }
}

export async function encryptJson({
  cryptoProvider,
  key,
  keyId,
  userId,
  recordType,
  recordId,
  value,
}) {
  assertSupportedDeviceKey(key);
  const iv = cryptoProvider.getRandomValues(new Uint8Array(12));
  const additionalData = buildAdditionalData({
    userId,
    keyId,
    recordType,
    recordId,
  });
  const plaintext = textEncoder.encode(JSON.stringify(value));
  const ciphertext = await cryptoProvider.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData, tagLength: 128 },
    key,
    plaintext,
  );
  return {
    scheme: "AES-256-GCM",
    schemeVersion: 1,
    keyId,
    userId,
    recordType,
    recordId,
    iv: bytesToBase64Url(iv),
    ciphertext: bytesToBase64Url(new Uint8Array(ciphertext)),
  };
}

export async function decryptJson({ cryptoProvider, key, envelope }) {
  assertSupportedDeviceKey(key);
  if (envelope.scheme !== "AES-256-GCM" || envelope.schemeVersion !== 1) {
    throw new Error("UNSUPPORTED_ENCRYPTION_SCHEME");
  }
  const additionalData = buildAdditionalData(envelope);
  const plaintext = await cryptoProvider.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: base64UrlToBytes(envelope.iv),
      additionalData,
      tagLength: 128,
    },
    key,
    base64UrlToBytes(envelope.ciphertext),
  );
  return JSON.parse(textDecoder.decode(plaintext));
}

export class IndexedDbLocalVault {
  #cryptoProvider;
  #databaseName;
  #databasePromise = null;
  #indexedDB;

  constructor({ indexedDB, cryptoProvider, databaseName }) {
    if (!indexedDB) throw new TypeError("indexedDB is required");
    if (!cryptoProvider?.subtle) {
      throw new TypeError("a Web Crypto provider is required");
    }
    assertNonEmpty("databaseName", databaseName);
    this.#indexedDB = indexedDB;
    this.#cryptoProvider = cryptoProvider;
    this.#databaseName = databaseName;
  }

  async #open() {
    if (this.#databasePromise) return this.#databasePromise;
    this.#databasePromise = new Promise((resolve, reject) => {
      const request = this.#indexedDB.open(this.#databaseName, 1);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains("keys")) {
          const keys = database.createObjectStore("keys", {
            keyPath: "keyId",
          });
          keys.createIndex("userId", "userId", { unique: false });
        }
        if (!database.objectStoreNames.contains("records")) {
          const records = database.createObjectStore("records", {
            keyPath: ["userId", "recordType", "recordId"],
          });
          records.createIndex("userId", "userId", { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return this.#databasePromise;
  }

  async close() {
    const database = await this.#open();
    database.close();
    this.#databasePromise = null;
  }

  async getOrCreateKey({ userId, deviceId, keyVersion = 1 }) {
    const keyId = buildKeyId(userId, deviceId, keyVersion);
    const existing = await this.getKeyRow(keyId);
    if (existing) return existing;

    const key = await generateDeviceKey(this.#cryptoProvider);
    const row = {
      keyId,
      userId,
      deviceId,
      keyVersion,
      key,
      createdAt: new Date().toISOString(),
    };
    const database = await this.#open();
    const transaction = database.transaction("keys", "readwrite");
    transaction.objectStore("keys").put(row);
    await transactionComplete(transaction);
    return row;
  }

  async getKeyRow(keyId) {
    const database = await this.#open();
    const transaction = database.transaction("keys", "readonly");
    const row = await requestResult(transaction.objectStore("keys").get(keyId));
    await transactionComplete(transaction);
    return row ?? null;
  }

  async deleteKey(keyId) {
    const database = await this.#open();
    const transaction = database.transaction("keys", "readwrite");
    transaction.objectStore("keys").delete(keyId);
    await transactionComplete(transaction);
  }

  async encryptRecord({
    userId,
    deviceId,
    keyVersion = 1,
    recordType,
    recordId,
    value,
  }) {
    const keyRow = await this.getOrCreateKey({
      userId,
      deviceId,
      keyVersion,
    });
    const envelope = await encryptJson({
      cryptoProvider: this.#cryptoProvider,
      key: keyRow.key,
      keyId: keyRow.keyId,
      userId,
      recordType,
      recordId,
      value,
    });
    const database = await this.#open();
    const transaction = database.transaction("records", "readwrite");
    transaction.objectStore("records").put({
      ...envelope,
      updatedAt: new Date().toISOString(),
    });
    await transactionComplete(transaction);
    return envelope;
  }

  async getEnvelope(userId, recordType, recordId) {
    const database = await this.#open();
    const transaction = database.transaction("records", "readonly");
    const envelope = await requestResult(
      transaction.objectStore("records").get([userId, recordType, recordId]),
    );
    await transactionComplete(transaction);
    return envelope ?? null;
  }

  async decryptRecord(userId, recordType, recordId) {
    const envelope = await this.getEnvelope(userId, recordType, recordId);
    if (!envelope) throw new Error("LOCAL_ENCRYPTED_RECORD_NOT_FOUND");
    const keyRow = await this.getKeyRow(envelope.keyId);
    if (!keyRow) throw new Error("LOCAL_KEY_UNAVAILABLE");
    if (keyRow.userId !== userId) throw new Error("LOCAL_KEY_USER_MISMATCH");
    return decryptJson({
      cryptoProvider: this.#cryptoProvider,
      key: keyRow.key,
      envelope,
    });
  }

  async overwriteEnvelope(envelope) {
    const database = await this.#open();
    const transaction = database.transaction("records", "readwrite");
    transaction.objectStore("records").put(envelope);
    await transactionComplete(transaction);
  }

  async listUserRecords(userId) {
    const database = await this.#open();
    const transaction = database.transaction("records", "readonly");
    const rows = await requestResult(
      transaction.objectStore("records").index("userId").getAll(userId),
    );
    await transactionComplete(transaction);
    return rows;
  }

  async eraseUser(userId) {
    const database = await this.#open();
    const transaction = database.transaction(
      ["keys", "records"],
      "readwrite",
    );
    await Promise.all([
      deleteIndexRows(transaction.objectStore("keys").index("userId"), userId),
      deleteIndexRows(
        transaction.objectStore("records").index("userId"),
        userId,
      ),
    ]);
    await transactionComplete(transaction);
  }
}
