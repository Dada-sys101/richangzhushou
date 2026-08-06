import { API_BASE_URL, getAccessToken, setAccessToken } from "../api/session";
import {
  clearUserData,
  cursorKey,
  deleteEntityRecord,
  deletePending,
  getEntity,
  getPending,
  hasAnyStoredData,
  idMapKey,
  kvGet,
  kvSet,
  listEntities,
  listPending,
  putEntity,
  putPending,
  stateKey,
  updatePending,
  type PendingMutation,
  type StoredEntity,
  type SyncAction,
  type SyncCurrentEntity,
  type SyncEntityType,
} from "./db";

export type {
  PendingMutation,
  SyncAction,
  SyncCurrentEntity,
  SyncEntityType,
} from "./db";

export interface SyncChange {
  changeType: "CREATE" | "UPDATE" | "DELETE";
  data: Record<string, unknown>;
  deletedAt: string | null;
  entityId: string;
  entityType: SyncEntityType;
  id: string;
  updatedAt: string;
  version: number;
}

export interface SyncChangesResponse {
  changes: SyncChange[];
  nextCursor: string | null;
}

export interface SyncMutationErrorBody {
  code: string;
  message: string;
  current?: SyncCurrentEntity;
}

export interface SyncMutationResult {
  clientMutationId: string;
  status: "OK" | "ERROR";
  result?: Record<string, unknown> | null;
  error?: SyncMutationErrorBody | null;
}

export interface SyncStatusResponse {
  appliedCount: number;
  conflictCount: number;
  failedCount: number;
  lastAppliedAt: string | null;
}

export type SyncStatus = "SYNCED" | "PENDING_SYNC" | "SYNC_FAILED" | "CONFLICT";

const PULL_LIMIT = 200;
const MAX_BATCH = 50;
const LAST_USER_KEY = "lastUser";

let currentUserId: string | null = null;
let flushing = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let backoffMs = 2_000;

export function currentUser(): string | null {
  return currentUserId;
}

export async function initSync(userId: string): Promise<void> {
  if (currentUserId === userId) {
    return;
  }
  currentUserId = userId;
  await kvSet(LAST_USER_KEY, { id: userId });
  backoffMs = 2_000;
  await pullChanges(userId);
  await flushPending(userId);
  scheduleFlush(userId);
  window.addEventListener("online", () => {
    if (currentUserId === userId) {
      void flushPending(userId);
    }
  });
}

export function stopSync(): void {
  currentUserId = null;
  if (flushTimer !== null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
}

export async function pullChanges(userId: string): Promise<void> {
  let cursor = await kvGet<string | null>(cursorKey(userId));
  for (let page = 0; page < 100; page += 1) {
    let response: SyncChangesResponse;
    try {
      response = await syncRequest<SyncChangesResponse>(
        `/sync/changes?limit=${PULL_LIMIT}${
          cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""
        }`,
      );
    } catch {
      return;
    }
    if (response.changes.length === 0) {
      await kvSet(cursorKey(userId), cursor);
      return;
    }
    for (const change of response.changes) {
      await applyChange(userId, change);
    }
    cursor = response.nextCursor;
    await kvSet(cursorKey(userId), cursor);
    if (!cursor) {
      return;
    }
  }
}

export async function applyChange(
  userId: string,
  change: SyncChange,
): Promise<void> {
  const entity: StoredEntity = {
    data: change.data,
    entityType: change.entityType,
    id: change.entityId,
    pending: false,
    updatedAt: change.updatedAt,
    userId,
  };
  await putEntity(entity);
}

export async function flushPending(userId: string): Promise<void> {
  if (flushing || !navigator.onLine) {
    return;
  }
  flushing = true;
  try {
    const pending = await listPending(userId, ["PENDING", "FAILED"]);
    if (pending.length === 0) {
      const conflicts = await listPending(userId, ["CONFLICT"]);
      await setState(userId, conflicts.length > 0 ? "CONFLICT" : "SYNCED");
      return;
    }
    const batch = await buildBatch(userId, pending);
    const response = await syncRequest<{
      results: SyncMutationResult[];
    }>("/sync/mutations", {
      body: { mutations: batch.map(toMutationRequest) },
      method: "POST",
    });
    for (const result of response.results) {
      const mutation = batch.find(
        (item) => item.id === result.clientMutationId,
      );
      if (!mutation) {
        continue;
      }
      if (result.status === "OK" && result.result) {
        const serverId = String(result.result.id ?? mutation.entityId ?? "");
        if (mutation.localId && mutation.localId !== serverId) {
          await addIdMap(userId, mutation.localId, serverId);
          await rewritePendingIds(userId, mutation.localId, serverId);
        }
        await putEntity({
          data: result.result,
          entityType: mutation.entityType,
          id: serverId,
          pending: false,
          updatedAt: new Date().toISOString(),
          userId,
        });
        if (mutation.localId && mutation.localId !== serverId) {
          await deleteEntityRecord(
            userId,
            mutation.entityType,
            mutation.localId,
          );
        }
        await deletePending(mutation.id);
      } else if (result.error) {
        const conflicted =
          result.error.code === "VERSION_CONFLICT" ||
          result.error.code === "IDEMPOTENCY_CONFLICT";
        await updatePending(mutation.id, {
          current: result.error.current ?? null,
          errorCode: result.error.code,
          errorMessage: result.error.message,
          status: conflicted ? "CONFLICT" : "FAILED",
        });
      }
    }
    await pullChanges(userId);
    const remaining = await listPending(userId, ["PENDING", "FAILED"]);
    const conflicts = await listPending(userId, ["CONFLICT"]);
    await setState(
      userId,
      conflicts.length > 0
        ? "CONFLICT"
        : remaining.length > 0
          ? "PENDING_SYNC"
          : "SYNCED",
    );
    if (remaining.length > 0) {
      scheduleFlush(userId);
    } else {
      backoffMs = 2_000;
    }
  } catch {
    await setState(userId, "SYNC_FAILED");
    scheduleFlush(userId);
  } finally {
    flushing = false;
    notifyChanged();
  }
}

export async function enqueueCreate(
  userId: string,
  entityType: SyncEntityType,
  payload: Record<string, unknown>,
  localId: string,
): Promise<void> {
  const mutation: PendingMutation = {
    action: "CREATE",
    createdAt: Date.now(),
    current: null,
    entityId: null,
    entityType,
    errorCode: null,
    errorMessage: null,
    id: localId,
    localId,
    payload,
    status: "PENDING",
    userId,
    version: null,
  };
  await putPending(mutation);
  await setState(userId, "PENDING_SYNC");
  notifyChanged();
  scheduleFlush(userId);
}

export async function enqueueChange(
  userId: string,
  entityType: SyncEntityType,
  action: Exclude<SyncAction, "CREATE">,
  entityId: string,
  version: number,
  payload: Record<string, unknown> = {},
): Promise<void> {
  const mutation: PendingMutation = {
    action,
    createdAt: Date.now(),
    current: null,
    entityId,
    entityType,
    errorCode: null,
    errorMessage: null,
    id: newMutationId(),
    localId: null,
    payload,
    status: "PENDING",
    userId,
    version,
  };
  await putPending(mutation);
  await setState(userId, "PENDING_SYNC");
  notifyChanged();
  scheduleFlush(userId);
}

export async function listLocal(
  userId: string,
  entityType: SyncEntityType,
): Promise<Record<string, unknown>[]> {
  const rows = await listEntities(userId, entityType);
  return rows.map((row) => row.data);
}

export async function getLocal(
  userId: string,
  entityType: SyncEntityType,
  id: string,
): Promise<Record<string, unknown> | null> {
  const row = await getEntity(userId, entityType, id);
  return row?.data ?? null;
}

export async function listPendingForUser(
  userId: string,
): Promise<PendingMutation[]> {
  return listPending(userId);
}

export async function resolveConflict(
  userId: string,
  mutationId: string,
  choice: "local" | "server",
): Promise<void> {
  const mutation = await getPending(mutationId);
  if (!mutation || mutation.userId !== userId) {
    return;
  }
  if (choice === "server" || mutation.errorCode === "IDEMPOTENCY_CONFLICT") {
    await deletePending(mutationId);
    await pullChanges(userId);
    await refreshState(userId);
    return;
  }
  const current = mutation.current;
  const serverId =
    current?.entityId ?? mutation.entityId ?? mutation.localId ?? "";
  const serverVersion = Number(current?.data.version ?? 1);
  const replacement: PendingMutation = {
    action: mutation.action,
    createdAt: Date.now(),
    current: null,
    entityId: serverId,
    entityType: mutation.entityType,
    errorCode: null,
    errorMessage: null,
    id: newMutationId(),
    localId: mutation.localId,
    payload: mutation.payload,
    status: "PENDING",
    userId,
    version: serverVersion,
  };
  await deletePending(mutationId);
  await putPending(replacement);
  await flushPending(userId);
  await refreshState(userId);
}

export async function getSyncStatusForUser(
  userId: string,
): Promise<SyncStatus> {
  const state = await kvGet<{ status: SyncStatus }>(stateKey(userId));
  return state?.status ?? "SYNCED";
}

export async function getPendingCounts(
  userId: string,
): Promise<{ pending: number; conflict: number }> {
  const all = await listPending(userId);
  return {
    conflict: all.filter((item) => item.status === "CONFLICT").length,
    pending: all.filter(
      (item) => item.status === "PENDING" || item.status === "FAILED",
    ).length,
  };
}

export async function resetUserData(userId: string): Promise<void> {
  await clearUserData(userId);
}

export function isNetworkOffline(): boolean {
  return !navigator.onLine;
}

export async function getLastUserId(): Promise<string | null> {
  const last = await kvGet<{ id: string }>(LAST_USER_KEY);
  return last?.id ?? null;
}

export async function hasAnyLocalData(): Promise<boolean> {
  return hasAnyStoredData();
}

async function buildBatch(
  userId: string,
  pending: PendingMutation[],
): Promise<PendingMutation[]> {
  const batch: PendingMutation[] = [];
  for (const mutation of pending) {
    if (batch.length >= MAX_BATCH) {
      break;
    }
    if (!(await referencesResolved(userId, mutation))) {
      break;
    }
    batch.push(mutation);
  }
  return batch;
}

async function referencesResolved(
  userId: string,
  mutation: PendingMutation,
): Promise<boolean> {
  const referenceFields = [
    "categoryId",
    "accountId",
    "tripId",
    "originalTransactionId",
    "targetId",
    "attachmentId",
  ] as const;
  const idMap = await getIdMap(userId);
  for (const field of referenceFields) {
    const value = mutation.payload[field];
    if (typeof value === "string" && value.startsWith("local-")) {
      if (!idMap[value]) {
        return false;
      }
    }
  }
  return true;
}

function toMutationRequest(mutation: PendingMutation): {
  action: SyncAction;
  clientMutationId: string;
  entityId: string | null;
  entityType: SyncEntityType;
  payload: Record<string, unknown>;
  version: number | null;
} {
  return {
    action: mutation.action,
    clientMutationId: mutation.id,
    entityId: mutation.entityId,
    entityType: mutation.entityType,
    payload: mutation.payload,
    version: mutation.version,
  };
}

async function setState(userId: string, status: SyncStatus): Promise<void> {
  await kvSet(stateKey(userId), {
    lastSyncedAt: new Date().toISOString(),
    status,
  });
}

async function refreshState(userId: string): Promise<void> {
  const pending = await listPending(userId);
  const conflicted = pending.some((item) => item.status === "CONFLICT");
  const waiting = pending.some(
    (item) => item.status === "PENDING" || item.status === "FAILED",
  );
  await setState(
    userId,
    conflicted ? "CONFLICT" : waiting ? "PENDING_SYNC" : "SYNCED",
  );
}

async function getIdMap(userId: string): Promise<Record<string, string>> {
  return (await kvGet<Record<string, string>>(idMapKey(userId))) ?? {};
}

async function addIdMap(
  userId: string,
  localId: string,
  serverId: string,
): Promise<void> {
  const map = await getIdMap(userId);
  map[localId] = serverId;
  await kvSet(idMapKey(userId), map);
}

async function rewritePendingIds(
  userId: string,
  localId: string,
  serverId: string,
): Promise<void> {
  const pending = await listPending(userId);
  for (const mutation of pending) {
    if (mutation.entityId === localId) {
      await updatePending(mutation.id, { entityId: serverId });
    }
  }
}

function scheduleFlush(userId: string): void {
  if (flushTimer !== null) {
    clearTimeout(flushTimer);
  }
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushPending(userId);
  }, backoffMs);
  backoffMs = Math.min(backoffMs * 2, 60_000);
}

async function syncRequest<T>(
  path: string,
  options: { body?: unknown; method?: string } = {},
): Promise<T> {
  let response = await doSyncFetch(path, options);
  if (response.status === 401 && (await refreshAccessToken())) {
    response = await doSyncFetch(path, options);
  }
  const text = await response.text();
  const data = text ? (JSON.parse(text) as unknown) : null;
  if (!response.ok) {
    throw new Error(
      (data as { message?: string } | null)?.message ?? "Sync request failed",
    );
  }
  return data as T;
}

async function doSyncFetch(
  path: string,
  options: { body?: unknown; method?: string },
): Promise<Response> {
  return fetch(`${API_BASE_URL}${path}`, {
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(getAccessToken()
        ? { Authorization: `Bearer ${getAccessToken()}` }
        : {}),
      "Content-Type": "application/json",
    },
    method: options.method ?? "GET",
  });
}

async function refreshAccessToken(): Promise<boolean> {
  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    credentials: "include",
    method: "POST",
  });
  if (!response.ok) {
    return false;
  }
  const data = (await response.json()) as { accessToken: string };
  setAccessToken(data.accessToken);
  return true;
}

export function newMutationId(): string {
  return `m-${crypto.randomUUID().replace(/-/g, "")}`;
}

export function newLocalEntityId(): string {
  return `local-${crypto.randomUUID().replace(/-/g, "")}`;
}

function notifyChanged(): void {
  window.dispatchEvent(new Event("daily-sync-changed"));
}
