import { defaultRepository } from "./repository-instance";
import {
  type LocalRepository,
  type StoredEntity,
  type SyncAction,
  type SyncEntityType,
} from "./repository";
import {
  currentUser,
  enqueueChange,
  enqueueCreate,
  newLocalEntityId,
} from "./sync";

export interface OfflineRoute {
  action: SyncAction;
  entityType: SyncEntityType;
  method: "DELETE" | "PATCH" | "POST";
  overridePayload?: Record<string, unknown>;
  pattern: RegExp;
  wrap?: (entity: Record<string, unknown>) => Record<string, unknown>;
}

export const OFFLINE_ROUTES: OfflineRoute[] = [
  {
    action: "CREATE",
    entityType: "TRANSACTION",
    method: "POST",
    pattern: /^\/transactions$/,
    wrap: (entity) => ({ transaction: entity }),
  },
  {
    action: "UPDATE",
    entityType: "TRANSACTION",
    method: "PATCH",
    pattern: /^\/transactions\/([^/]+)$/,
    wrap: (entity) => ({ transaction: entity }),
  },
  {
    action: "DELETE",
    entityType: "TRANSACTION",
    method: "DELETE",
    pattern: /^\/transactions\/([^/]+)$/,
  },
  {
    action: "RESTORE",
    entityType: "TRANSACTION",
    method: "POST",
    pattern: /^\/transactions\/([^/]+)\/restore$/,
  },
  {
    action: "CREATE",
    entityType: "CATEGORY",
    method: "POST",
    pattern: /^\/categories$/,
  },
  {
    action: "UPDATE",
    entityType: "CATEGORY",
    method: "PATCH",
    pattern: /^\/categories\/([^/]+)$/,
  },
  {
    action: "CREATE",
    entityType: "FINANCIAL_ACCOUNT",
    method: "POST",
    pattern: /^\/financial-accounts$/,
  },
  {
    action: "UPDATE",
    entityType: "FINANCIAL_ACCOUNT",
    method: "PATCH",
    pattern: /^\/financial-accounts\/([^/]+)$/,
  },
  {
    action: "CREATE",
    entityType: "BUDGET",
    method: "POST",
    pattern: /^\/budgets$/,
  },
  {
    action: "UPDATE",
    entityType: "BUDGET",
    method: "PATCH",
    pattern: /^\/budgets\/([^/]+)$/,
  },
  {
    action: "DELETE",
    entityType: "BUDGET",
    method: "DELETE",
    pattern: /^\/budgets\/([^/]+)$/,
  },
  {
    action: "CREATE",
    entityType: "CALENDAR_EVENT",
    method: "POST",
    pattern: /^\/calendar-events$/,
    wrap: (entity) => ({ calendarEvent: entity }),
  },
  {
    action: "UPDATE",
    entityType: "CALENDAR_EVENT",
    method: "PATCH",
    pattern: /^\/calendar-events\/([^/]+)$/,
    wrap: (entity) => ({ calendarEvent: entity }),
  },
  {
    action: "DELETE",
    entityType: "CALENDAR_EVENT",
    method: "DELETE",
    pattern: /^\/calendar-events\/([^/]+)$/,
  },
  {
    action: "RESTORE",
    entityType: "CALENDAR_EVENT",
    method: "POST",
    pattern: /^\/calendar-events\/([^/]+)\/restore$/,
  },
  {
    action: "CREATE",
    entityType: "TASK",
    method: "POST",
    pattern: /^\/tasks$/,
  },
  {
    action: "UPDATE",
    entityType: "TASK",
    method: "PATCH",
    pattern: /^\/tasks\/([^/]+)$/,
  },
  {
    action: "UPDATE",
    entityType: "TASK",
    method: "POST",
    overridePayload: { status: "COMPLETED" },
    pattern: /^\/tasks\/([^/]+)\/complete$/,
    wrap: (entity) => ({ task: entity }),
  },
  {
    action: "DELETE",
    entityType: "TASK",
    method: "DELETE",
    pattern: /^\/tasks\/([^/]+)$/,
  },
  {
    action: "RESTORE",
    entityType: "TASK",
    method: "POST",
    pattern: /^\/tasks\/([^/]+)\/restore$/,
  },
  {
    action: "CREATE",
    entityType: "REMINDER",
    method: "POST",
    pattern: /^\/reminders$/,
  },
  {
    action: "UPDATE",
    entityType: "REMINDER",
    method: "PATCH",
    pattern: /^\/reminders\/([^/]+)$/,
  },
  {
    action: "DELETE",
    entityType: "REMINDER",
    method: "DELETE",
    pattern: /^\/reminders\/([^/]+)$/,
  },
  {
    action: "RESTORE",
    entityType: "REMINDER",
    method: "POST",
    pattern: /^\/reminders\/([^/]+)\/restore$/,
  },
  {
    action: "CREATE",
    entityType: "TRIP",
    method: "POST",
    pattern: /^\/trips$/,
  },
  {
    action: "UPDATE",
    entityType: "TRIP",
    method: "PATCH",
    pattern: /^\/trips\/([^/]+)$/,
  },
  {
    action: "DELETE",
    entityType: "TRIP",
    method: "DELETE",
    pattern: /^\/trips\/([^/]+)$/,
  },
  {
    action: "RESTORE",
    entityType: "TRIP",
    method: "POST",
    pattern: /^\/trips\/([^/]+)\/restore$/,
  },
  {
    action: "CREATE",
    entityType: "TRIP_ITEM",
    method: "POST",
    pattern: /^\/trips\/([^/]+)\/items$/,
    wrap: (entity) => ({ tripItem: entity }),
  },
  {
    action: "UPDATE",
    entityType: "TRIP_ITEM",
    method: "PATCH",
    pattern: /^\/trip-items\/([^/]+)$/,
    wrap: (entity) => ({ tripItem: entity }),
  },
  {
    action: "DELETE",
    entityType: "TRIP_ITEM",
    method: "DELETE",
    pattern: /^\/trip-items\/([^/]+)$/,
  },
  {
    action: "RESTORE",
    entityType: "TRIP_ITEM",
    method: "POST",
    pattern: /^\/trip-items\/([^/]+)\/restore$/,
  },
  {
    action: "CREATE",
    entityType: "PACKING_ITEM",
    method: "POST",
    pattern: /^\/trips\/([^/]+)\/packing-items$/,
  },
  {
    action: "UPDATE",
    entityType: "PACKING_ITEM",
    method: "PATCH",
    pattern: /^\/packing-items\/([^/]+)$/,
  },
  {
    action: "DELETE",
    entityType: "PACKING_ITEM",
    method: "DELETE",
    pattern: /^\/packing-items\/([^/]+)$/,
  },
  {
    action: "RESTORE",
    entityType: "PACKING_ITEM",
    method: "POST",
    pattern: /^\/packing-items\/([^/]+)\/restore$/,
  },
  {
    action: "UPDATE",
    entityType: "DRAFT_RECORD",
    method: "PATCH",
    pattern: /^\/drafts\/([^/]+)$/,
  },
  {
    action: "DELETE",
    entityType: "DRAFT_RECORD",
    method: "POST",
    pattern: /^\/drafts\/([^/]+)\/discard$/,
  },
];

export function matchOfflineRoute(
  method: string,
  path: string,
): OfflineRoute | null {
  return (
    OFFLINE_ROUTES.find(
      (route) => route.method === method && route.pattern.test(path),
    ) ?? null
  );
}

export async function handleOffline(
  route: OfflineRoute,
  path: string,
  body: unknown,
  repository: LocalRepository = defaultRepository,
): Promise<unknown> {
  const userId = currentUser();
  if (!userId) {
    throw new Error("Not authenticated for offline queue");
  }
  const payload = (body ?? {}) as Record<string, unknown>;
  const match = route.pattern.exec(path);
  const pathEntityId = match?.[1] ?? null;

  if (route.action === "CREATE") {
    const localId = newLocalEntityId();
    const parentId = match?.[1] ?? null;
    const queuedPayload =
      route.entityType === "TRIP_ITEM" || route.entityType === "PACKING_ITEM"
        ? { ...payload, tripId: payload.tripId ?? parentId }
        : payload;
    const entity = buildPlaceholder(
      route.entityType,
      queuedPayload,
      localId,
      parentId,
    );
    await repository.entityPut(userId, route.entityType, {
      data: entity,
      entityType: route.entityType,
      id: localId,
      pending: true,
      updatedAt: entity.updatedAt as string,
      userId,
    });
    await enqueueCreate(
      userId,
      route.entityType,
      queuedPayload,
      localId,
      repository,
    );
    return route.wrap ? route.wrap(entity) : entity;
  }

  const targetId = pathEntityId ?? String(payload.id ?? "");
  const local = await repository.entityGet(userId, route.entityType, targetId);
  const now = new Date().toISOString();

  if (local?.pending) {
    if (route.action === "DELETE") {
      await repository.entityDelete(userId, route.entityType, targetId);
      const pending = await repository.pendingList(userId);
      const create = pending.find(
        (item) =>
          item.action === "CREATE" &&
          item.localId === targetId &&
          item.entityType === route.entityType,
      );
      if (create) {
        await repository.pendingDelete(userId, create.id);
      }
      return undefined;
    }
    const merged = mergeEntity(
      local.data,
      route.action === "RESTORE" ? {} : payload,
      route.action,
      now,
    );
    await repository.entityPut(userId, route.entityType, {
      ...local,
      data: merged,
      pending: true,
      updatedAt: now,
    });
    const pending = await repository.pendingList(userId);
    const create = pending.find(
      (item) =>
        item.action === "CREATE" &&
        item.localId === targetId &&
        item.entityType === route.entityType,
    );
    if (create) {
      await repository.pendingUpdate(userId, create.id, {
        payload: { ...create.payload, ...payload },
      });
    }
    return wrapOrEntity(route, merged);
  }

  const version =
    typeof payload.version === "number"
      ? payload.version
      : Number(local?.data.version ?? 1) || 1;
  const changePayload = route.overridePayload ?? payload;
  await enqueueChange(
    userId,
    route.entityType,
    route.action,
    targetId,
    version,
    changePayload,
    repository,
  );
  if (route.action === "DELETE") {
    const tombstone = mergeEntity(local?.data ?? {}, {}, "DELETE", now);
    await repository.entityPut(userId, route.entityType, {
      data: tombstone,
      entityType: route.entityType,
      id: targetId,
      pending: true,
      updatedAt: now,
      userId,
    });
    return undefined;
  }
  const merged = mergeEntity(
    local?.data ?? {},
    changePayload,
    route.action,
    now,
  );
  await repository.entityPut(userId, route.entityType, {
    data: merged,
    entityType: route.entityType,
    id: targetId,
    pending: true,
    updatedAt: now,
    userId,
  });
  return wrapOrEntity(route, merged);
}

function wrapOrEntity(
  route: OfflineRoute,
  entity: Record<string, unknown>,
): Record<string, unknown> {
  return route.wrap ? route.wrap(entity) : entity;
}

function mergeEntity(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
  action: SyncAction,
  now: string,
): Record<string, unknown> {
  const merged = { ...base, ...patch };
  if (action === "DELETE") {
    merged.deletedAt = now;
  } else if (action === "RESTORE") {
    merged.deletedAt = null;
  }
  merged.updatedAt = now;
  merged.version = Number(merged.version ?? 1) + 1;
  return merged;
}

function buildPlaceholder(
  entityType: SyncEntityType,
  payload: Record<string, unknown>,
  id: string,
  parentId: string | null,
): Record<string, unknown> {
  const now = new Date().toISOString();
  const base = {
    createdAt: now,
    deletedAt: null,
    id,
    updatedAt: now,
    version: 1,
  };
  switch (entityType) {
    case "TRANSACTION":
      return {
        ...base,
        accountId: payload.accountId ?? null,
        amount: payload.amount ?? "0.00",
        categoryId: payload.categoryId ?? null,
        currency: payload.currency ?? "CNY",
        isUnlinkedRefund: payload.isUnlinkedRefund ?? false,
        merchant: payload.merchant ?? null,
        note: payload.note ?? null,
        occurredAt: payload.occurredAt ?? now,
        originalTransactionId: payload.originalTransactionId ?? null,
        source: payload.source ?? "MANUAL",
        sourceFingerprint: payload.sourceFingerprint ?? null,
        status: "CONFIRMED",
        tripId: payload.tripId ?? null,
        type: payload.type ?? "EXPENSE",
      };
    case "CATEGORY":
      return {
        ...base,
        color: payload.color ?? "#64748B",
        isArchived: false,
        kind: payload.kind ?? "EXPENSE",
        name: payload.name ?? "",
      };
    case "FINANCIAL_ACCOUNT":
      return {
        ...base,
        isArchived: false,
        kind: payload.kind ?? "CASH",
        name: payload.name ?? "",
      };
    case "BUDGET":
      return {
        ...base,
        amount: payload.amount ?? "0.00",
        categoryId: payload.categoryId ?? null,
        currency: payload.currency ?? "CNY",
        month: payload.month ?? "",
      };
    case "CALENDAR_EVENT":
      return {
        ...base,
        allDay: payload.allDay ?? false,
        endsAt: payload.endsAt ?? now,
        startsAt: payload.startsAt ?? now,
        status: "SCHEDULED",
        title: payload.title ?? "",
      };
    case "TASK":
      return {
        ...base,
        cancelledAt: null,
        completedAt: null,
        dueAt: payload.dueAt ?? null,
        overdue: false,
        priority: payload.priority ?? "MEDIUM",
        status: "OPEN",
        title: payload.title ?? "",
      };
    case "REMINDER":
      return {
        ...base,
        attemptCount: 0,
        failureReason: null,
        note: payload.note ?? null,
        recurrence: payload.recurrence ?? null,
        scheduleType: payload.scheduleType ?? "ONCE",
        scheduledAt: payload.startsAt ?? now,
        sentAt: null,
        startsAt: payload.startsAt ?? now,
        status: "SCHEDULED",
        suppressedAt: null,
        targetId: payload.targetId ?? null,
        targetType: payload.targetType ?? "STANDALONE",
        title: payload.title ?? "",
      };
    case "TRIP":
      return {
        ...base,
        budgetAmount: payload.budgetAmount ?? null,
        destination: payload.destination ?? "",
        endDate: payload.endDate ?? "",
        startDate: payload.startDate ?? "",
        title: payload.title ?? "",
      };
    case "TRIP_ITEM":
      return {
        ...base,
        endsAt: payload.endsAt ?? now,
        location: payload.location ?? null,
        position: payload.position ?? 0,
        startsAt: payload.startsAt ?? now,
        tripId: payload.tripId ?? parentId,
        type: payload.type ?? "OTHER",
      };
    case "PACKING_ITEM":
      return {
        ...base,
        checked: false,
        position: payload.position ?? 0,
        text: payload.text ?? "",
        tripId: payload.tripId ?? parentId,
      };
    case "DRAFT_RECORD":
      return {
        ...base,
        attachmentId: null,
        clientMutationId: id,
        confidence: null,
        confirmedAt: null,
        discardedAt: null,
        failureReason: null,
        payload: payload.payload ?? {},
        resultId: null,
        source: payload.source ?? "MANUAL",
        status: "PENDING",
        targetType: "TRANSACTION",
      };
    default:
      return { ...base, ...payload };
  }
}

export type { StoredEntity };
