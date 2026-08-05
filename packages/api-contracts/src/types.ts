import type {
  ApiErrorCode,
  CategoryKind,
  FinancialAccountKind,
  RecordSource,
  RecordStatus,
  TransactionType,
} from "./enums.js";

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

export interface CategorySummary extends VersionedResource {
  kind: CategoryKind;
  name: string;
  color: string;
  isArchived: boolean;
}

export interface CategoryCreateRequest {
  kind: CategoryKind;
  name: string;
  color?: string;
}

export interface CategoryUpdateRequest {
  kind?: CategoryKind;
  name?: string;
  color?: string;
  isArchived?: boolean;
  version: number;
}

export interface CategoryListResponse {
  items: CategorySummary[];
}

export interface FinancialAccountSummary extends VersionedResource {
  name: string;
  kind: FinancialAccountKind;
  isArchived: boolean;
}

export interface FinancialAccountCreateRequest {
  name: string;
  kind: FinancialAccountKind;
}

export interface FinancialAccountUpdateRequest {
  name?: string;
  kind?: FinancialAccountKind;
  isArchived?: boolean;
  version: number;
}

export interface FinancialAccountListResponse {
  items: FinancialAccountSummary[];
}

export interface TransactionSummary extends VersionedResource {
  type: TransactionType;
  status: RecordStatus;
  amount: Money;
  currency: string;
  categoryId: Identifier | null;
  accountId: Identifier | null;
  merchant: string | null;
  occurredAt: IsoDateTime;
  note: string | null;
  source: RecordSource;
  originalTransactionId: Identifier | null;
  isUnlinkedRefund: boolean;
  sourceFingerprint: string | null;
}

export interface TransactionCreateRequest {
  type: TransactionType;
  amount: Money;
  currency?: string;
  categoryId?: Identifier | null;
  accountId?: Identifier | null;
  merchant?: string | null;
  occurredAt?: IsoDateTime;
  note?: string | null;
  source?: RecordSource;
  originalTransactionId?: Identifier | null;
  isUnlinkedRefund?: boolean;
  sourceFingerprint?: string | null;
  clientMutationId?: string | null;
}

export interface TransactionUpdateRequest {
  type?: TransactionType;
  amount?: Money;
  currency?: string;
  categoryId?: Identifier | null;
  accountId?: Identifier | null;
  merchant?: string | null;
  occurredAt?: IsoDateTime;
  note?: string | null;
  source?: RecordSource;
  originalTransactionId?: Identifier | null;
  isUnlinkedRefund?: boolean;
  sourceFingerprint?: string | null;
  version: number;
}

export interface DuplicateWarning {
  code: "POSSIBLE_DUPLICATE";
  matchedTransactionId: Identifier;
  message: string;
}

export interface TransactionCreatedResponse {
  transaction: TransactionSummary;
  duplicateWarning?: DuplicateWarning;
}

export interface TransactionListResponse {
  items: TransactionSummary[];
  nextCursor: Identifier | null;
}

export interface BudgetSummary extends VersionedResource {
  categoryId: Identifier | null;
  month: string;
  amount: Money;
  currency: string;
}

export interface BudgetCreateRequest {
  categoryId?: Identifier | null;
  month: string;
  amount: Money;
  currency?: string;
}

export interface BudgetUpdateRequest {
  categoryId?: Identifier | null;
  month?: string;
  amount?: Money;
  currency?: string;
  version: number;
}

export interface BudgetListResponse {
  items: BudgetSummary[];
}

export interface BudgetProgress {
  budgetId: Identifier;
  categoryId: Identifier | null;
  categoryName: string | null;
  amount: Money;
  spent: Money;
  remaining: Money;
  progress: string;
}

export interface FinanceSummaryResponse {
  month: string;
  currency: string;
  totalExpense: Money;
  totalRefund: Money;
  netExpense: Money;
  totalIncome: Money;
  todaySpend: Money;
  budgets: BudgetProgress[];
  updatedAt: IsoDateTime;
}
