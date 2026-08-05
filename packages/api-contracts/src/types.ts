import type { ApiErrorCode } from "./enums.js";

/** API boundary IDs are strings even if storage choices change. */
export type Identifier = string;

/** ISO 8601 timestamp string at the API boundary. */
export type IsoDateTime = string;

/** Fixed-point decimal string; never a JavaScript binary floating-point amount. */
export type Money = string;

export interface FieldError {
  field: string;
  message: string;
}

export interface ErrorResponse {
  code: ApiErrorCode;
  fieldErrors?: FieldError[];
  message: string;
  requestId: string;
}

export interface PageInfo {
  nextCursor: string | null;
}

export interface VersionedResource {
  createdAt: IsoDateTime;
  deletedAt: IsoDateTime | null;
  id: Identifier;
  updatedAt: IsoDateTime;
  version: number;
}

export interface UserSummary {
  id: Identifier;
  displayName: string;
  email: string;
  role: "USER" | "ADMIN";
  status: "ACTIVE" | "SUSPENDED" | "CLOSED" | "DELETION_PENDING" | "DELETED";
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  closedAt: IsoDateTime | null;
  deletionRequestedAt: IsoDateTime | null;
}

export interface SessionSummary {
  id: Identifier;
  createdAt: IsoDateTime;
  expiresAt: IsoDateTime;
  revokedAt: IsoDateTime | null;
  lastUsedAt: IsoDateTime | null;
}

export interface AuthSessionResponse {
  accessToken: string;
  expiresIn: number;
  user: UserSummary;
}

export interface RegisterRequest {
  displayName: string;
  email: string;
  password: string;
  inviteCode?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  recoveryToken: string;
  newPassword: string;
}

export interface ReopenAccountRequest {
  recoveryToken: string;
  newPassword: string;
}

export interface CloseAccountRequest {
  password: string;
  reason: string;
}

export interface RequestDeletionRequest {
  password: string;
  reason: string;
}

export interface AdminReasonRequest {
  reason: string;
}

export interface InviteSummary {
  id: Identifier;
  codePrefix: string;
  status: "ACTIVE" | "EXHAUSTED" | "EXPIRED" | "REVOKED";
  expiresAt: IsoDateTime | null;
  maxUses: number;
  usedCount: number;
  createdAt: IsoDateTime;
  revokedAt: IsoDateTime | null;
}

export interface InviteCreateRequest {
  expiresAt?: IsoDateTime | null;
  maxUses: number;
  reason: string;
}

export interface InviteCreatedResponse {
  invite: InviteSummary;
  plaintextCode: string;
}

export interface RegistrationSettings {
  registrationEnabled: boolean;
  inviteRequired: boolean;
  maxActiveUsers: number;
}

export interface UpdateRegistrationSettingsRequest {
  registrationEnabled?: boolean;
  inviteRequired?: boolean;
  maxActiveUsers?: number;
  reason: string;
}

export interface AdminDashboardResponse extends RegistrationSettings {
  activeUsers: number;
  suspendedUsers: number;
  occupiedSlots: number;
  remainingSlots: number;
}

export interface AdminUserSummary {
  id: Identifier;
  maskedEmail: string;
  role: "USER" | "ADMIN";
  status: "ACTIVE" | "SUSPENDED" | "CLOSED" | "DELETION_PENDING" | "DELETED";
  createdAt: IsoDateTime;
  closedAt: IsoDateTime | null;
  deletionRequestedAt: IsoDateTime | null;
}

export interface AdminAuditEntry {
  id: Identifier;
  action: string;
  targetType: string;
  targetId: Identifier | null;
  reason: string;
  actorEmail: string | null;
  requestId: string;
  createdAt: IsoDateTime;
  changes: Record<string, unknown>;
}
