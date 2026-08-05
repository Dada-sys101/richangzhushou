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

export const API_ERROR_CODES = [
  "REGISTRATION_DISABLED",
  "CAPACITY_REACHED",
  "INVITE_INVALID",
  "INVITE_EXPIRED",
  "INVITE_EXHAUSTED",
  "ACCOUNT_NOT_ACTIVE",
  "REOPEN_CAPACITY_REACHED",
  "IDEMPOTENCY_CONFLICT",
  "VERSION_CONFLICT",
  "DRAFT_CONFIRMATION_REQUIRED",
  "RESOURCE_NOT_FOUND",
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];
