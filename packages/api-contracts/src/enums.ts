export const USER_ROLES = ["USER", "ADMIN"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = [
  "ACTIVE",
  "SUSPENDED",
  "CLOSED",
  "DELETION_PENDING",
  "DELETION_PROCESSING",
  "DELETED",
] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const TRANSACTION_TYPES = ["EXPENSE", "INCOME", "REFUND"] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const RECORD_STATUSES = ["DRAFT", "CONFIRMED", "DELETED"] as const;
export type RecordStatus = (typeof RECORD_STATUSES)[number];

export const RECORD_SOURCES = [
  "MANUAL",
  "SHORTCUT",
  "TEXT",
  "VOICE",
  "IMPORT",
] as const;
export type RecordSource = (typeof RECORD_SOURCES)[number];

export const CATEGORY_KINDS = ["EXPENSE", "INCOME"] as const;
export type CategoryKind = (typeof CATEGORY_KINDS)[number];

export const FINANCIAL_ACCOUNT_KINDS = [
  "CASH",
  "DEBIT_CARD",
  "CREDIT_CARD",
  "DIGITAL_WALLET",
  "OTHER",
] as const;
export type FinancialAccountKind = (typeof FINANCIAL_ACCOUNT_KINDS)[number];

export const TASK_STATUSES = ["OPEN", "COMPLETED", "CANCELLED"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const CALENDAR_EVENT_STATUSES = ["SCHEDULED", "CANCELLED"] as const;
export type CalendarEventStatus = (typeof CALENDAR_EVENT_STATUSES)[number];

export const REMINDER_STATUSES = [
  "SCHEDULED",
  "SENT",
  "CANCELLED",
  "FAILED",
  "SUPPRESSED",
] as const;
export type ReminderStatus = (typeof REMINDER_STATUSES)[number];

export const REMINDER_SCHEDULE_TYPES = [
  "ONCE",
  "DAILY",
  "WEEKLY",
  "MONTHLY",
] as const;
export type ReminderScheduleType = (typeof REMINDER_SCHEDULE_TYPES)[number];

export const REMINDER_TARGET_TYPES = [
  "CALENDAR_EVENT",
  "TASK",
  "STANDALONE",
] as const;
export type ReminderTargetType = (typeof REMINDER_TARGET_TYPES)[number];

export const SYNC_STATES = [
  "SYNCED",
  "PENDING_SYNC",
  "SYNC_FAILED",
  "CONFLICT",
] as const;
export type SyncState = (typeof SYNC_STATES)[number];

export const SYNC_ENTITY_TYPES = [
  "TRANSACTION",
  "CATEGORY",
  "FINANCIAL_ACCOUNT",
  "BUDGET",
  "CALENDAR_EVENT",
  "TASK",
  "REMINDER",
  "TRIP",
  "TRIP_ITEM",
  "PACKING_ITEM",
  "DRAFT_RECORD",
] as const;
export type SyncEntityType = (typeof SYNC_ENTITY_TYPES)[number];

export const SYNC_CHANGE_TYPES = ["CREATE", "UPDATE", "DELETE"] as const;
export type SyncChangeType = (typeof SYNC_CHANGE_TYPES)[number];

export const SYNC_ACTIONS = ["CREATE", "UPDATE", "DELETE", "RESTORE"] as const;
export type SyncAction = (typeof SYNC_ACTIONS)[number];

export const SYNC_MUTATION_RESULT_STATUSES = ["OK", "ERROR"] as const;
export type SyncMutationResultStatus =
  (typeof SYNC_MUTATION_RESULT_STATUSES)[number];

export const DRAFT_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "DISCARDED",
  "FAILED",
] as const;
export type DraftStatus = (typeof DRAFT_STATUSES)[number];

export const SHORTCUT_SCOPES = [
  "transaction:draft:create",
  "finance:summary:read",
] as const;
export type ShortcutScope = (typeof SHORTCUT_SCOPES)[number];

export const ATTACHMENT_OWNER_TYPES = ["TRANSACTION_DRAFT"] as const;
export type AttachmentOwnerType = (typeof ATTACHMENT_OWNER_TYPES)[number];

export const DRAFT_TARGET_TYPES = ["TRANSACTION"] as const;
export type DraftTargetType = (typeof DRAFT_TARGET_TYPES)[number];

export const TRIP_ITEM_TYPES = [
  "TRANSPORT",
  "STAY",
  "ACTIVITY",
  "FOOD",
  "OTHER",
] as const;
export type TripItemType = (typeof TRIP_ITEM_TYPES)[number];

export const AI_REQUEST_STATUSES = [
  "CLAIMED",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
] as const;
export type AiRequestStatus = (typeof AI_REQUEST_STATUSES)[number];

export const AI_PROPOSAL_STATUSES = [
  "PENDING_REVIEW",
  "PARTIALLY_APPLIED",
  "APPLIED",
  "REJECTED",
  "EXPIRED",
  "FAILED",
  "CANCELLED",
] as const;
export type AiProposalStatus = (typeof AI_PROPOSAL_STATUSES)[number];

export const AI_OPERATION_TYPES = [
  "TRANSACTION",
  "CALENDAR_EVENT",
  "TASK",
  "REMINDER",
  "TRIP",
] as const;
export type AiOperationType = (typeof AI_OPERATION_TYPES)[number];

export const AI_OPERATION_STATUSES = [
  "PENDING",
  "ACCEPTED",
  "REJECTED",
  "APPLIED",
  "FAILED",
  "EXPIRED",
] as const;
export type AiOperationStatus = (typeof AI_OPERATION_STATUSES)[number];

export const AI_PROVIDER_ATTEMPT_STATUSES = [
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
] as const;
export type AiProviderAttemptStatus =
  (typeof AI_PROVIDER_ATTEMPT_STATUSES)[number];

export const API_ERROR_CODES = [
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "RATE_LIMITED",
  "CAPACITY_REACHED",
  "INVALID_CREDENTIALS",
  "INVALID_CURRENT_PASSWORD",
  "PASSWORD_CHANGE_REQUIRED",
  "ACCOUNT_NOT_ACTIVE",
  "REFRESH_TOKEN_REQUIRED",
  "REFRESH_TOKEN_INVALID",
  "INVALID_STATE",
  "SETTING_LOWER_THAN_USAGE",
  "ADMIN_ACTION_REQUIRES_REASON",
  "IDEMPOTENCY_CONFLICT",
  "VERSION_CONFLICT",
  "DUPLICATE_RESOURCE",
  "DRAFT_CONFIRMATION_REQUIRED",
  "CREDENTIAL_INVALID",
  "CREDENTIAL_REVOKED",
  "ATTACHMENT_TYPE_NOT_ALLOWED",
  "ATTACHMENT_TOO_LARGE",
  "DRAFT_NOT_EDITABLE",
  "UPLOAD_INTENT_EXPIRED",
  "UPLOAD_TOKEN_INVALID",
  "CONFIRMATION_TOKEN_INVALID",
  "CONFIRMATION_TOKEN_EXPIRED",
  "CURSOR_INVALID",
  "MUTATION_BATCH_TOO_LARGE",
  "MUTATION_UNSUPPORTED",
  "RESOURCE_NOT_FOUND",
  "INTERNAL_ERROR",
  "AI_DISABLED",
  "AI_REQUEST_NOT_FOUND",
  "AI_PROPOSAL_NOT_FOUND",
  "AI_PROPOSAL_INVALID_STATE",
  "AI_OPERATION_INVALID_STATE",
  "AI_INPUT_VALIDATION_ERROR",
  "AI_SCHEMA_VALIDATION_ERROR",
  "AI_DOMAIN_VALIDATION_ERROR",
  "AI_PROVIDER_ERROR",
  "AI_PROVIDER_TIMEOUT",
  "AI_PROVIDER_NETWORK_ERROR",
  "AI_BUDGET_BLOCKED",
  "AI_CIRCUIT_BREAKER_BLOCKED",
  "AI_MALFORMED_OUTPUT",
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export const ADMIN_AUDIT_ACTIONS = [
  "SETTINGS_UPDATE",
  "USER_CREATE",
  "USER_PASSWORD_RESET",
  "USER_SUSPEND",
  "USER_CLOSE",
  "USER_REOPEN",
  "USER_DELETE_REQUEST",
  "USER_DELETE_CANCEL",
  "USER_DELETION_COMPLETED",
  "DRAFT_BATCH_DISCARD",
] as const;
export type AdminAuditAction = (typeof ADMIN_AUDIT_ACTIONS)[number];
