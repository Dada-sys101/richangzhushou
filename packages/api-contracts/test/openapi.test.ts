import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import {
  API_ERROR_CODES,
  CATEGORY_KINDS,
  DRAFT_STATUSES,
  FINANCIAL_ACCOUNT_KINDS,
  INVITE_STATUSES,
  PRIORITIES,
  RECORD_SOURCES,
  RECORD_STATUSES,
  REMINDER_STATUSES,
  SYNC_STATES,
  TASK_STATUSES,
  TRANSACTION_TYPES,
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
  "POST /trips/{id}/items",
  "PATCH /trip-items/{id}",
  "DELETE /trip-items/{id}",
  "POST /trips/{id}/packing-items",
  "PATCH /packing-items/{id}",
  "DELETE /packing-items/{id}",
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
    ["ReminderStatus", REMINDER_STATUSES],
    ["SyncState", SYNC_STATES],
    ["DraftStatus", DRAFT_STATUSES],
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
});
