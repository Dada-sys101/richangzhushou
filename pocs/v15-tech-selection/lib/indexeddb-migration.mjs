import {
  assertSupportedDeviceKey,
  decryptJson,
  encryptJson,
  generateDeviceKey,
} from "./local-crypto.mjs";

export const DATABASE_VERSION_V1 = 1;
export const DATABASE_VERSION_V2 = 2;
export const MIGRATION_ID = "v1-to-v2";

export const STORES = Object.freeze({
  kv: "kv",
  entitiesV1: "entities",
  pendingV1: "pending",
  entitiesV2: "entities_v2",
  pendingV2: "