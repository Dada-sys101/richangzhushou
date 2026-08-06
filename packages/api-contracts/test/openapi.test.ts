import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import {
  API_ERROR_CODES,
  ATTACHMENT_SCAN_STATUSES,
  CALENDAR_EVENT_STATUSES,
  CATEGORY_KINDS,
  DRAFT_STATUSES,
  FINANCIAL_ACCOUNT_KINDS,
  INVITE_STATUSES,
  PRIORITIES,
  RECORD_SOURCES,
  RECORD_STATUSES,
  REMINDER_SCHEDULE_TYPES,
  REMINDER_STATUSES,
  REMINDER_TARGET_TYPES,
  SHORTCUT_SCOPES,
  SYNC_ACTIONS,
  SYNC_CHANGE_TYPES,
  SYNC_ENTITY_TYPES,
  SYNC_STATES,
  TASK_STATUSES,
  TRANSACTION_TYPES,
  TRIP_ITEM_TYPES,
  USER_ROLES,
  USER_STATUSES,
} from "../src/enums.js";

interface OpenApiDocument {
  components: {
    schemas: Record<
      string,
      { enum?: string[]; pattern?: string; type?: string }
    >;
  };
  openapi: string;
  paths: Record<string, Record<string, unknown>>;
}

const openApiPath = new URL("../openapi/openapi.yaml", import.meta.url);
const document = parse(await readFile(openApiPath, "utf8")) as OpenApiDocument;

const requiredOperations = [
  "POST /auth/register",
  "POST /auth/login",
  "POST /auth/refresh",
  "POST /auth/logout",
  "POST /auth/forgot-password",
  "POST /auth/reset-password",
  "GET /me",
  "POST /me/close",
  "POST /me/reopen",
  "POST /me/request-deletion",
  "DELETE /me/sessions",
  "DELETE /me/sessions/{sessionId}",
  "GET /transactions",
  "POST /transactions",
  "GET /transactions/{id}",
  "PATCH /transactions/{id}",
  "DELETE /transactions/{id}",
  "POST /transactions/{id}/restore",
  "GET /categories",
  "POST /categories",
  "PATCH /categories/{id}",
  "GET /financial-accounts",
  "POST /financial-accounts",
  "PATCH /financial-accounts/{id}",
  "GET /budgets",
  "POST /budgets",
  "PATCH /budgets/{id}",
  "DELETE /budgets/{id}",
  "GET /finance/summary",
  "GET /finance/export.csv",
  "POST /drafts/parse-text",
  "POST /drafts/ocr",
  "GET /drafts",
  "GET /drafts/{id}",
  "PATCH /drafts/{id}",
  "POST /drafts/{id}/confirm",
  "POST /drafts/{id}/discard",
  "POST /shortcut-credentials",
  "GET /shortcut-credentials",
  "DELETE /shortcut-credentials/{id}",
  "POST /shortcuts/transaction-drafts",
  "GET /shortcuts/today-spend",
  "GET /calendar-events",
  "POST /calendar-events",
  "GET /calendar-events/{id}",
  "PATCH /calendar-events/{id}",
  "DELETE /calendar-events/{id}",
  "GET /tasks",
  "POST /tasks",
  "GET /tasks/{id}",
  "PATCH /tasks/{id}",
  "DELETE /tasks/{id}",
  "POST /tasks/{id}/complete",
  "GET /reminders",
  "POST /reminders",
  "GET /reminders/{id}",
  "PATCH /reminders/{id}",
  "DELETE /reminders/{id}",
  "GET /trips",
  "POST /trips",
  "GET /trips/{id}",
  "PATCH /trips/{id}",
  "DELETE /trips/{id}",
  "POST /trips/{id}/restore",
  "POST /trips/{id}/items",
  "GET /trip-items/{id}",
  "PATCH /trip-items/{id}",
  "DELETE /trip-items/{id}",
  "POST /trip-items/{id}/restore",
  "POST /trips/{id}/packing-items",
  "GET /packing-items/{id}",
  "PATCH /packing-items/{id}",
  "DELETE /packing-items/{id}",
  "POST /packing-items/{id}/restore",
  "POST /attachments/upload-intents",
  "POST /attachments/{id}/complete",
  "DELETE /attachments/{id}",
  "GET /sync/changes",
  "POST /sync/mutations",
  "GET /sync/status",
  "GET /admin/dashboard",
  "GET /admin/invites",
  "POST /admin/invites",
  "POST /admin/invites/{id}/revoke",
  "GET /admin/users",
  "POST /admin/users/{id}/suspend",
  "POST /admin/users/{id}/close",
  "POST /admin/users/{id}/reopen",
  "GET /admin/settings/registration",
  "PATCH /admin/settings/registration",
  "GET /admin/audits",
  "GET /admin/health",
] as const;

describe("OpenAPI baseline", () => {
  it("uses OpenAPI 3.1", () => {
    expect(document.openapi).toBe("3.1.0");
  });

  it.each(requiredOperations)("contains %s from docs/06", (operation) => {
    const [method, path] = operation.split(" ") as [string, string];
    expect(document.paths[path]?.[method.toLowerCase()]).toBeDefined();
  });

  it("uses string boundary types for IDs and fixed-point money", () => {
    expect(document.components.schemas.Identifier?.type).toBe("string");
    expect(document.components.schemas.Money?.type).toBe("string");
    expect(document.components.schemas.Money?.pattern).toBe(
      "^-?\\d+\\.\\d{2}$",
    );
  });

  it.each([
    ["ApiErrorCode", API_ERROR_CODES],
    ["UserRole", USER_ROLES],
    ["UserStatus", USER_STATUSES],
    ["InviteStatus", INVITE_STATUSES],
    ["TransactionType", TRANSACTION_TYPES],
    ["RecordStatus", RECORD_STATUSES],
    ["RecordSource", RECORD_SOURCES],
    ["CategoryKind", CATEGORY_KINDS],
    ["FinancialAccountKind", FINANCIAL_ACCOUNT_KINDS],
    ["TaskStatus", TASK_STATUSES],
    ["Priority", PRIORITIES],
    ["CalendarEventStatus", CALENDAR_EVENT_STATUSES],
    ["ReminderStatus", REMINDER_STATUSES],
    ["ReminderScheduleType", REMINDER_SCHEDULE_TYPES],
    ["ReminderTargetType", REMINDER_TARGET_TYPES],
    ["SyncState", SYNC_STATES],
    ["SyncEntityType", SYNC_ENTITY_TYPES],
    ["SyncChangeType", SYNC_CHANGE_TYPES],
    ["SyncAction", SYNC_ACTIONS],
    ["DraftStatus", DRAFT_STATUSES],
    ["ShortcutScope", SHORTCUT_SCOPES],
    ["AttachmentScanStatus", ATTACHMENT_SCAN_STATUSES],
    ["TripItemType", TRIP_ITEM_TYPES],
  ] as const)(
    "keeps %s aligned with shared TypeScript",
    (schemaName, values) => {
      expect(document.components.schemas[schemaName]?.enum).toEqual([
        ...values,
      ]);
    },
  );

  it("defines the WP3 finance request and response contracts", () => {
    const schemas = document.components.schemas;
    for (const name of [
      "TransactionCreateRequest",
      "TransactionUpdateRequest",
      "TransactionSummary",
      "TransactionCreatedResponse",
      "TransactionListResponse",
      "CategoryCreateRequest",
      "CategoryUpdateRequest",
      "CategorySummary",
      "FinancialAccountCreateRequest",
      "FinancialAccountUpdateRequest",
      "FinancialAccountSummary",
      "BudgetCreateRequest",
      "BudgetUpdateRequest",
      "BudgetSummary",
      "FinanceSummaryResponse",
      "DuplicateWarning",
    ]) {
      expect(schemas[name]).toBeDefined();
    }
    expect(schemas.Month?.pattern).toBe("^(19|20)\\d{2}-(0[1-9]|1[0-2])$");
    expect(schemas.TransactionCreateRequest?.required).toEqual([
      "type",
      "amount",
    ]);
    expect(schemas.TransactionUpdateRequest?.required).toEqual(["version"]);
    expect(schemas.BudgetCreateRequest?.required).toEqual(["month", "amount"]);
    expect(schemas.FinanceSummaryResponse?.required).toEqual(
      expect.arrayContaining([
        "totalExpense",
        "totalRefund",
        "netExpense",
        "totalIncome",
        "todaySpend",
        "budgets",
      ]),
    );
    expect(schemas.ApiErrorCode?.enum).toContain("DUPLICATE_RESOURCE");
    expect(API_ERROR_CODES).toContain("DUPLICATE_RESOURCE");
  });

  it("defines the WP4 drafts, shortcuts, and attachments contracts", () => {
    const schemas = document.components.schemas;
    for (const name of [
      "TransactionDraftPayload",
      "DraftSummary",
      "DraftListResponse",
      "ParseTextRequest",
      "DraftCreatedResponse",
      "OcrDraftRequest",
      "DraftUpdateRequest",
      "DraftConfirmResponse",
      "DraftBatchDiscardRequest",
      "DraftBatchDiscardIntentResponse",
      "DraftBatchDiscardConfirmRequest",
      "DraftBatchDiscardResult",
      "ShortcutCredentialSummary",
      "ShortcutCredentialCreateRequest",
      "ShortcutCredentialCreatedResponse",
      "ShortcutCredentialListResponse",
      "ShortcutTransactionDraftRequest",
      "ShortcutTodaySpendResponse",
      "AttachmentUploadIntentRequest",
      "AttachmentUploadIntentResponse",
      "AttachmentSummary",
      "AttachmentCompleteResponse",
    ]) {
      expect(schemas[name]).toBeDefined();
    }
    expect(schemas.ShortcutScope?.enum).toEqual([...SHORTCUT_SCOPES]);
    expect(schemas.AttachmentScanStatus?.enum).toEqual([
      ...ATTACHMENT_SCAN_STATUSES,
    ]);
    expect(schemas.ShortcutTransactionDraftRequest?.required).toEqual([
      "type",
      "amount",
    ]);
    expect(schemas.DraftBatchDiscardRequest?.required).toEqual(["reason"]);
    for (const code of [
      "CREDENTIAL_INVALID",
      "CREDENTIAL_REVOKED",
      "OCR_UNAVAILABLE",
      "ATTACHMENT_TYPE_NOT_ALLOWED",
      "ATTACHMENT_TOO_LARGE",
      "ATTACHMENT_SCAN_FAILED",
      "DRAFT_NOT_EDITABLE",
      "UPLOAD_INTENT_EXPIRED",
      "UPLOAD_TOKEN_INVALID",
      "CONFIRMATION_TOKEN_INVALID",
      "CONFIRMATION_TOKEN_EXPIRED",
    ]) {
      expect(API_ERROR_CODES).toContain(code);
      expect(schemas.ApiErrorCode?.enum).toContain(code);
    }
  });

  it("defines the WP5 calendar, task, and reminder contracts", () => {
    const schemas = document.components.schemas;
    for (const name of [
      "CalendarEventSummary",
      "CalendarEventCreateRequest",
      "CalendarEventUpdateRequest",
      "CalendarEventListResponse",
      "CalendarEventCreatedResponse",
      "CalendarOverlapWarning",
      "TaskSummary",
      "TaskCreateRequest",
      "TaskUpdateRequest",
      "TaskListResponse",
      "TaskCompleteResponse",
      "ReminderRecurrence",
      "ReminderSummary",
      "ReminderCreateRequest",
      "ReminderUpdateRequest",
      "ReminderListResponse",
    ]) {
      expect(schemas[name]).toBeDefined();
    }
    expect(schemas.CalendarEventCreateRequest?.required).toEqual([
      "title",
      "startsAt",
      "endsAt",
    ]);
    expect(schemas.CalendarEventUpdateRequest?.required).toEqual(["version"]);
    expect(schemas.TaskCreateRequest?.required).toEqual(["title"]);
    expect(schemas.TaskUpdateRequest?.required).toEqual(["version"]);
    expect(schemas.ReminderCreateRequest?.required).toEqual([
      "title",
      "scheduleType",
      "startsAt",
    ]);
    expect(schemas.ReminderUpdateRequest?.required).toEqual(["version"]);
    expect(schemas.CalendarOverlapWarning?.properties?.code).toEqual({
      type: "string",
      const: "OVERLAP_WARNING",
    });
    expect(schemas.CalendarEventStatus?.enum).toEqual([
      ...CALENDAR_EVENT_STATUSES,
    ]);
    expect(schemas.ReminderScheduleType?.enum).toEqual([
      ...REMINDER_SCHEDULE_TYPES,
    ]);
    expect(schemas.ReminderTargetType?.enum).toEqual([
      ...REMINDER_TARGET_TYPES,
    ]);
  });

  it("keeps every finance operation secured by the access token", () => {
    const financePaths = [
      "/transactions",
      "/transactions/{id}",
      "/transactions/{id}/restore",
      "/categories",
      "/categories/{id}",
      "/financial-accounts",
      "/financial-accounts/{id}",
      "/budgets",
      "/budgets/{id}",
      "/finance/summary",
      "/finance/export.csv",
    ];
    for (const path of financePaths) {
      for (const [method, operation] of Object.entries(document.paths[path])) {
        expect(operation.security ?? document.security).toEqual([
          { accessToken: [] },
        ]);
        void method;
      }
    }
  });

  it("keeps shortcut operations on the shortcut token and user content on the access token", () => {
    const shortcutPaths = [
      "/shortcuts/transaction-drafts",
      "/shortcuts/today-spend",
    ];
    for (const path of shortcutPaths) {
      for (const operation of Object.values(document.paths[path])) {
        expect(operation.security).toEqual([{ shortcutToken: [] }]);
      }
    }
    const userContentPaths = [
      "/drafts/parse-text",
      "/drafts/ocr",
      "/drafts",
      "/drafts/{id}",
      "/drafts/{id}/confirm",
      "/drafts/{id}/discard",
      "/drafts/batch-discard",
      "/drafts/batch-discard/confirm",
      "/shortcut-credentials",
      "/shortcut-credentials/{id}",
      "/attachments/upload-intents",
      "/attachments/{id}/complete",
      "/attachments/{id}",
    ];
    for (const path of userContentPaths) {
      for (const operation of Object.values(document.paths[path])) {
        expect(operation.security ?? document.security).toEqual([
          { accessToken: [] },
        ]);
      }
    }
    const contentOperations = Object.values(
      document.paths["/attachments/{id}/content"],
    );
    for (const operation of contentOperations) {
      expect(operation.security).toEqual([]);
    }
  });

  it("keeps calendar, task, and reminder operations on the access token", () => {
    const wp5Paths = [
      "/calendar-events",
      "/calendar-events/{id}",
      "/calendar-events/{id}/restore",
      "/tasks",
      "/tasks/{id}",
      "/tasks/{id}/restore",
      "/tasks/{id}/complete",
      "/reminders",
      "/reminders/{id}",
      "/reminders/{id}/restore",
    ];
    for (const path of wp5Paths) {
      for (const [method, operation] of Object.entries(document.paths[path])) {
        expect(operation.security ?? document.security).toEqual([
          { accessToken: [] },
        ]);
        void method;
      }
    }
  });

  it("defines the WP6 trip, trip item, and packing item contracts", () => {
    const schemas = document.components.schemas;
    for (const name of [
      "TripSummary",
      "TripCreateRequest",
      "TripUpdateRequest",
      "TripListResponse",
      "TripItemSummary",
      "TripItemCreateRequest",
      "TripItemUpdateRequest",
      "TripItemOutOfRangeWarning",
      "TripItemCreatedResponse",
      "PackingItemSummary",
      "PackingItemCreateRequest",
      "PackingItemUpdateRequest",
      "TripExpenseSummary",
      "TripDetailResponse",
    ]) {
      expect(schemas[name]).toBeDefined();
    }
    expect(schemas.TripItemType?.enum).toEqual([...TRIP_ITEM_TYPES]);
    expect(schemas.TripCreateRequest?.required).toEqual([
      "title",
      "destination",
      "startDate",
      "endDate",
    ]);
    expect(schemas.TripUpdateRequest?.required).toEqual(["version"]);
    expect(schemas.TripItemCreateRequest?.required).toEqual([
      "type",
      "startsAt",
      "endsAt",
    ]);
    expect(schemas.TripItemUpdateRequest?.required).toEqual(["version"]);
    expect(schemas.PackingItemCreateRequest?.required).toEqual(["text"]);
    expect(schemas.PackingItemUpdateRequest?.required).toEqual(["version"]);
    expect(schemas.TripItemOutOfRangeWarning?.properties?.code).toEqual({
      type: "string",
      const: "TRIP_ITEM_OUT_OF_RANGE",
    });
    expect(schemas.TripDetailResponse?.required).toEqual(
      expect.arrayContaining([
        "trip",
        "items",
        "packingItems",
        "expense",
        "linkedTransactions",
        "calendarEvents",
      ]),
    );
    expect(schemas.TripExpenseSummary?.required).toEqual([
      "actualExpense",
      "budgetAmount",
      "budgetProgress",
    ]);
    expect(schemas.TransactionSummary?.properties?.tripId).toBeDefined();
    expect(schemas.TransactionCreateRequest?.properties?.tripId).toBeDefined();
    expect(schemas.TransactionUpdateRequest?.properties?.tripId).toBeDefined();
  });

  it("defines the WP7 sync, cursor, mutation, and conflict contracts", () => {
    const schemas = document.components.schemas;
    for (const name of [
      "SyncChange",
      "SyncChangesResponse",
      "SyncMutationRequest",
      "SyncMutationBatchRequest",
      "SyncMutationResult",
      "SyncMutationsResponse",
      "SyncCurrentEntity",
      "SyncMutationError",
      "SyncStatusResponse",
    ]) {
      expect(schemas[name]).toBeDefined();
    }
    expect(
      schemas.SyncMutationBatchRequest?.properties?.mutations,
    ).toMatchObject({ maxItems: 50 });
    expect(schemas.SyncMutationResult?.properties?.status).toEqual({
      type: "string",
      enum: ["OK", "ERROR"],
    });
    expect(schemas.SyncChangesResponse?.required).toEqual([
      "changes",
      "nextCursor",
    ]);
    expect(schemas.SyncStatusResponse?.required).toEqual([
      "appliedCount",
      "failedCount",
      "conflictCount",
      "lastAppliedAt",
    ]);
    expect(schemas.SyncChange?.required).toEqual(
      expect.arrayContaining([
        "entityType",
        "entityId",
        "changeType",
        "version",
        "updatedAt",
        "deletedAt",
        "data",
      ]),
    );
    for (const code of [
      "CURSOR_INVALID",
      "MUTATION_BATCH_TOO_LARGE",
      "MUTATION_UNSUPPORTED",
    ]) {
      expect(API_ERROR_CODES).toContain(code);
      expect(schemas.ApiErrorCode?.enum).toContain(code);
    }
    expect(
      schemas.CategoryCreateRequest?.properties?.clientMutationId,
    ).toBeDefined();
    expect(
      schemas.FinancialAccountCreateRequest?.properties?.clientMutationId,
    ).toBeDefined();
    expect(
      schemas.BudgetCreateRequest?.properties?.clientMutationId,
    ).toBeDefined();
  });

  it("keeps sync operations on the access token", () => {
    const syncPaths = ["/sync/changes", "/sync/mutations", "/sync/status"];
    for (const path of syncPaths) {
      for (const operation of Object.values(document.paths[path])) {
        expect(operation.security ?? document.security).toEqual([
          { accessToken: [] },
        ]);
      }
    }
  });

  it("keeps trip operations on the access token", () => {
    const tripPaths = [
      "/trips",
      "/trips/{id}",
      "/trips/{id}/restore",
      "/trips/{id}/items",
      "/trip-items/{id}",
      "/trip-items/{id}/restore",
      "/trips/{id}/packing-items",
      "/packing-items/{id}",
      "/packing-items/{id}/restore",
    ];
    for (const path of tripPaths) {
      for (const [method, operation] of Object.entries(document.paths[path])) {
        expect(operation.security ?? document.security).toEqual([
          { accessToken: [] },
        ]);
        void method;
      }
    }
  });
});
