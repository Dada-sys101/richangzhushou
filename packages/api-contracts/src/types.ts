import type {
  ApiErrorCode,
  AttachmentOwnerType,
  AttachmentScanStatus,
  CalendarEventStatus,
  CategoryKind,
  DraftTargetType,
  FinancialAccountKind,
  Priority,
  RecordSource,
  RecordStatus,
  ReminderScheduleType,
  ReminderStatus,
  ReminderTargetType,
  ShortcutScope,
  SyncAction,
  SyncChangeType,
  SyncEntityType,
  TaskStatus,
  TransactionType,
  TripItemType,
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
  clientMutationId?: string | null;
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
  clientMutationId?: string | null;
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
  tripId: Identifier | null;
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
  tripId?: Identifier | null;
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
  tripId?: Identifier | null;
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
  clientMutationId?: string | null;
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

export interface CalendarOverlapWarning {
  code: "OVERLAP_WARNING";
  conflictingEventId: Identifier;
  message: string;
}

export interface CalendarEventSummary extends VersionedResource {
  title: string;
  startsAt: IsoDateTime;
  endsAt: IsoDateTime;
  allDay: boolean;
  status: CalendarEventStatus;
}

export interface CalendarEventCreateRequest {
  title: string;
  startsAt: IsoDateTime;
  endsAt: IsoDateTime;
  allDay?: boolean;
  clientMutationId?: string | null;
}

export interface CalendarEventUpdateRequest {
  title?: string;
  startsAt?: IsoDateTime;
  endsAt?: IsoDateTime;
  allDay?: boolean;
  status?: CalendarEventStatus;
  version: number;
}

export interface CalendarEventListResponse {
  items: CalendarEventSummary[];
  nextCursor: Identifier | null;
}

export interface CalendarEventCreatedResponse {
  calendarEvent: CalendarEventSummary;
  overlapWarning?: CalendarOverlapWarning;
}

export interface TaskSummary extends VersionedResource {
  title: string;
  status: TaskStatus;
  priority: Priority;
  dueAt: IsoDateTime | null;
  overdue: boolean;
  completedAt: IsoDateTime | null;
  cancelledAt: IsoDateTime | null;
}

export interface TaskCreateRequest {
  title: string;
  priority?: Priority;
  dueAt?: IsoDateTime | null;
  clientMutationId?: string | null;
}

export interface TaskUpdateRequest {
  title?: string;
  priority?: Priority;
  dueAt?: IsoDateTime | null;
  status?: TaskStatus;
  version: number;
}

export interface TaskListResponse {
  items: TaskSummary[];
  nextCursor: Identifier | null;
}

export interface TaskCompleteResponse {
  task: TaskSummary;
}

export interface ReminderRecurrence {
  interval?: number;
  weekdays?: number[];
  dayOfMonth?: number;
  until?: IsoDateTime | null;
}

export interface ReminderSummary extends VersionedResource {
  title: string;
  note: string | null;
  targetType: ReminderTargetType;
  targetId: Identifier | null;
  scheduleType: ReminderScheduleType;
  scheduledAt: IsoDateTime;
  recurrence: ReminderRecurrence | null;
  status: ReminderStatus;
  attemptCount: number;
  sentAt: IsoDateTime | null;
  suppressedAt: IsoDateTime | null;
  failureReason: string | null;
}

export interface ReminderCreateRequest {
  title: string;
  note?: string | null;
  targetType?: ReminderTargetType;
  targetId?: Identifier | null;
  scheduleType: ReminderScheduleType;
  startsAt: IsoDateTime;
  recurrence?: ReminderRecurrence | null;
  clientMutationId?: string | null;
}

export interface ReminderUpdateRequest {
  title?: string;
  note?: string | null;
  targetType?: ReminderTargetType;
  targetId?: Identifier | null;
  scheduleType?: ReminderScheduleType;
  startsAt?: IsoDateTime;
  recurrence?: ReminderRecurrence | null;
  status?: ReminderStatus;
  version: number;
}

export interface ReminderListResponse {
  items: ReminderSummary[];
  nextCursor: Identifier | null;
}

export interface TripSummary extends VersionedResource {
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  budgetAmount: Money | null;
}

export interface TripCreateRequest {
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  budgetAmount?: Money | null;
  clientMutationId?: string | null;
}

export interface TripUpdateRequest {
  title?: string;
  destination?: string;
  startDate?: string;
  endDate?: string;
  budgetAmount?: Money | null;
  version: number;
}

export interface TripListResponse {
  items: TripSummary[];
  nextCursor: Identifier | null;
}

export interface TripItemSummary extends VersionedResource {
  tripId: Identifier;
  type: TripItemType;
  startsAt: IsoDateTime;
  endsAt: IsoDateTime;
  location: string | null;
  position: number;
}

export interface TripItemCreateRequest {
  type: TripItemType;
  startsAt: IsoDateTime;
  endsAt: IsoDateTime;
  location?: string | null;
  position?: number;
  confirmOutOfRange?: boolean;
  clientMutationId?: string | null;
}

export interface TripItemUpdateRequest {
  type?: TripItemType;
  startsAt?: IsoDateTime;
  endsAt?: IsoDateTime;
  location?: string | null;
  position?: number;
  confirmOutOfRange?: boolean;
  version: number;
}

export interface TripItemOutOfRangeWarning {
  code: "TRIP_ITEM_OUT_OF_RANGE";
  message: string;
}

export interface TripItemCreatedResponse {
  tripItem: TripItemSummary;
  outOfRangeWarning?: TripItemOutOfRangeWarning;
}

export interface PackingItemSummary extends VersionedResource {
  tripId: Identifier;
  text: string;
  checked: boolean;
  position: number;
}

export interface PackingItemCreateRequest {
  text: string;
  position?: number;
  clientMutationId?: string | null;
}

export interface PackingItemUpdateRequest {
  text?: string;
  checked?: boolean;
  position?: number;
  version: number;
}

export interface TripExpenseSummary {
  actualExpense: Money;
  budgetAmount: Money | null;
  budgetProgress: string | null;
}

export interface TripDetailResponse {
  trip: TripSummary;
  items: TripItemSummary[];
  packingItems: PackingItemSummary[];
  expense: TripExpenseSummary;
  linkedTransactions: TransactionSummary[];
  calendarEvents: CalendarEventSummary[];
}

export interface TransactionDraftPayload {
  type: TransactionType;
  amount: Money;
  currency?: string;
  categoryId?: Identifier | null;
  accountId?: Identifier | null;
  merchant?: string | null;
  occurredAt?: IsoDateTime;
  note?: string | null;
  originalTransactionId?: Identifier | null;
  isUnlinkedRefund?: boolean;
  tripId?: Identifier | null;
}

export interface DraftSummary {
  id: Identifier;
  source: RecordSource;
  targetType: DraftTargetType;
  payload: TransactionDraftPayload;
  confidence: Record<string, number> | null;
  status: "PENDING" | "CONFIRMED" | "DISCARDED" | "FAILED";
  clientMutationId: string | null;
  attachmentId: Identifier | null;
  failureReason: string | null;
  version: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  confirmedAt: IsoDateTime | null;
  discardedAt: IsoDateTime | null;
  resultId: Identifier | null;
}

export interface DraftListResponse {
  items: DraftSummary[];
  nextCursor: Identifier | null;
}

export interface ParseTextRequest {
  text: string;
}

export interface DraftCreatedResponse {
  draft: DraftSummary;
}

export interface OcrDraftRequest {
  attachmentId: Identifier;
  clientMutationId?: string | null;
}

export interface DraftUpdateRequest {
  payload: TransactionDraftPayload;
  version: number;
}

export interface DraftConfirmResponse {
  draft: DraftSummary;
  transaction: TransactionSummary;
}

export interface DraftBatchDiscardRequest {
  ids?: Identifier[];
  reason: string;
}

export interface DraftBatchDiscardIntentResponse {
  confirmationToken: string;
  affectedDraftIds: Identifier[];
  expiresAt: IsoDateTime;
}

export interface DraftBatchDiscardConfirmRequest {
  confirmationToken: string;
}

export interface DraftBatchDiscardResult {
  discardedCount: number;
}

export interface SyncChange {
  id: Identifier;
  entityType: SyncEntityType;
  entityId: Identifier;
  changeType: SyncChangeType;
  version: number;
  updatedAt: IsoDateTime;
  deletedAt: IsoDateTime | null;
  data: Record<string, unknown>;
}

export interface SyncChangesResponse {
  changes: SyncChange[];
  nextCursor: string | null;
}

export interface SyncMutationRequest {
  clientMutationId: string;
  entityType: SyncEntityType;
  action: SyncAction;
  entityId?: Identifier | null;
  payload?: Record<string, unknown>;
  version?: number | null;
}

export interface SyncMutationBatchRequest {
  mutations: SyncMutationRequest[];
}

export interface SyncCurrentEntity {
  entityType: SyncEntityType;
  entityId: Identifier;
  data: Record<string, unknown>;
}

export interface SyncMutationError {
  code: ApiErrorCode;
  message: string;
  current?: SyncCurrentEntity;
}

export interface SyncMutationResult {
  clientMutationId: string;
  status: "OK" | "ERROR";
  result?: Record<string, unknown> | null;
  error?: SyncMutationError | null;
}

export interface SyncMutationsResponse {
  results: SyncMutationResult[];
}

export interface SyncStatusResponse {
  appliedCount: number;
  failedCount: number;
  conflictCount: number;
  lastAppliedAt: IsoDateTime | null;
}

export interface ShortcutCredentialSummary {
  id: Identifier;
  name: string;
  scopes: ShortcutScope[];
  tokenPrefix: string;
  createdAt: IsoDateTime;
  lastUsedAt: IsoDateTime | null;
  revokedAt: IsoDateTime | null;
}

export interface ShortcutCredentialCreateRequest {
  name: string;
  scopes: ShortcutScope[];
}

export interface ShortcutCredentialCreatedResponse {
  credential: ShortcutCredentialSummary;
  plaintextToken: string;
}

export interface ShortcutCredentialListResponse {
  items: ShortcutCredentialSummary[];
}

export interface ShortcutTransactionDraftRequest {
  type: TransactionType;
  amount: Money;
  currency?: string;
  categoryId?: Identifier | null;
  accountId?: Identifier | null;
  merchant?: string | null;
  occurredAt?: IsoDateTime;
  note?: string | null;
  originalTransactionId?: Identifier | null;
  isUnlinkedRefund?: boolean;
  tripId?: Identifier | null;
}

export interface ShortcutTodaySpendResponse {
  date: string;
  currency: string;
  todaySpend: Money;
}

export interface AttachmentUploadIntentRequest {
  ownerType: AttachmentOwnerType;
  mimeType: string;
  size?: number;
}

export interface AttachmentUploadIntentResponse {
  id: Identifier;
  uploadUrl: string;
  uploadMethod: "PUT";
  uploadToken: string;
  expiresAt: IsoDateTime;
}

export interface AttachmentSummary {
  id: Identifier;
  ownerType: AttachmentOwnerType;
  ownerId: Identifier | null;
  mimeType: string;
  size: number;
  scanStatus: AttachmentScanStatus;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  deletedAt: IsoDateTime | null;
}

export interface AttachmentCompleteResponse {
  attachment: AttachmentSummary;
}
