export const USER_ROLES = ["USER", "ADMIN"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = [
  "ACTIVE",
  "SUSPENDED",
  "CLOSED",
  "DELETION_PENDING",
  "DELETED",
] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const INVITE_STATUSES = [
  "ACTIVE",
  "EXHAUSTED",
  "EXPIRED",
  "REVOKED",
] as const;
export type InviteStatus = (typeof INVITE_STATUSES)[number];

export const TRANSACTION_TYPES = ["EXPENSE", "INCOME", "REFUND"] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const RECORD_STATUSES = ["DRAFT", "CONFIRMED", "DELETED"] as const;
export type RecordStatus = (typeof RECORD_STATUSES)[number];

export const RECORD_SOURCES = [
  "MANUAL",
  "SHORTCUT",
  "OCR",
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

export const REMINDER_STATUSES = [
  "SCHEDULED",
  "SENT",
  "CANCELLED",
  "FAILED",
  "SUPPRESSED",
] as const;
export type ReminderStatus = (typeof REMINDER_STATUSES)[number];

export const SYNC_STATES = [
  "SYNCED",
  "PENDING_SYNC",
  "SYNC_FAILED",
  "CONFLICT",
] as const;
export type SyncState = (typeof SYNC_STATES)[number];

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

export const ATTACHMENT_SCAN_STATUSES = [
  "PENDING",
  "SCANNED",
  "FAILED",
] as const;
export type AttachmentScanStatus = (typeof ATTACHMENT_SCAN_STATUSES)[number];

export const ATTACHMENT_OWNER_TYPES = ["TRANSACTION_DRAFT"] as const;
export type AttachmentOwnerType = (typeof ATTACHMENT_OWNER_TYPES)[number];

export const DRAFT_TARGET_TYPES = ["TRANSACTION"] as const;
export type DraftTargetType = (typeof DRAFT_TARGET_TYPES)[number];

export const API_ERROR_CODES = [
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "RATE_LIMITED",
  "REGISTRATION_DISABLED",
  "CAPACITY_REACHED",
  "INVITE_INVALID",
  "INVITE_EXPIRED",
  "INVITE_EXHAUSTED",
  "EMAIL_ALREADY_REGISTERED",
  "INVALID_CREDENTIALS",
  "ACCOUNT_NOT_ACTIVE",
  "REFRESH_TOKEN_REQUIRED",
  "REFRESH_TOKEN_INVALID",
  "RECOVERY_TOKEN_INVALID",
  "RECOVERY_TOKEN_EXPIRED",
  "RECOVERY_TOKEN_USED",
  "REOPEN_CAPACITY_REACHED",
  "REOPEN_NOT_ALLOWED",
  "INVALID_STATE",
  "SETTING_LOWER_THAN_USAGE",
  "ADMIN_ACTION_REQUIRES_REASON",
  "IDEMPOTENCY_CONFLICT",
  "VERSION_CONFLICT",
  "DUPLICATE_RESOURCE",
  "DRAFT_CONFIRMATION_REQUIRED",
  "CREDENTIAL_INVALID",
  "CREDENTIAL_REVOKED",
  "OCR_UNAVAILABLE",
  "ATTACHMENT_TYPE_NOT_ALLOWED",
  "ATTACHMENT_TOO_LARGE",
  "ATTACHMENT_SCAN_FAILED",
  "ATTACHMENT_NOT_READY",
  "DRAFT_NOT_EDITABLE",
  "UPLOAD_INTENT_EXPIRED",
  "UPLOAD_TOKEN_INVALID",
  "CONFIRMATION_TOKEN_INVALID",
  "CONFIRMATION_TOKEN_EXPIRED",
  "RESOURCE_NOT_FOUND",
  "INTERNAL_ERROR",
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export const RECOVERY_CODE_KINDS = ["PASSWORD_RESET", "REOPEN"] as const;
export type RecoveryCodeKind = (typeof RECOVERY_CODE_KINDS)[number];

export const ADMIN_AUDIT_ACTIONS = [
  "SETTINGS_UPDATE",
  "INVITE_CREATE",
  "INVITE_REVOKE",
  "USER_SUSPEND",
  "USER_CLOSE",
  "USER_REOPEN",
  "USER_DELETE_REQUEST",
] as const;
export type AdminAuditAction = (typeof ADMIN_AUDIT_ACTIONS)[number];
