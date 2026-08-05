export const API_BASE_URL = "/api/v1";

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export interface FieldError {
  field: string;
  message: string;
}

export interface ApiErrorBody {
  code: string;
  fieldErrors?: FieldError[];
  message: string;
  requestId: string;
}

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fieldErrors?: FieldError[],
  ) {
    super(message);
  }
}

export interface UserSummary {
  closedAt: string | null;
  createdAt: string;
  deletionRequestedAt: string | null;
  displayName: string;
  email: string;
  id: string;
  role: "ADMIN" | "USER";
  status: "ACTIVE" | "CLOSED" | "DELETED" | "DELETION_PENDING" | "SUSPENDED";
  updatedAt: string;
}

export interface AuthSessionResponse {
  accessToken: string;
  expiresIn: number;
  user: UserSummary;
}

export type TransactionType = "EXPENSE" | "INCOME" | "REFUND";
export type CategoryKind = "EXPENSE" | "INCOME";
export type FinancialAccountKind =
  "CASH" | "DEBIT_CARD" | "CREDIT_CARD" | "DIGITAL_WALLET" | "OTHER";

export interface TransactionSummary {
  accountId: string | null;
  amount: string;
  categoryId: string | null;
  createdAt: string;
  currency: string;
  deletedAt: string | null;
  id: string;
  isUnlinkedRefund: boolean;
  merchant: string | null;
  note: string | null;
  occurredAt: string;
  originalTransactionId: string | null;
  source: string;
  sourceFingerprint: string | null;
  status: string;
  type: TransactionType;
  updatedAt: string;
  version: number;
}

export interface CategorySummary {
  color: string;
  createdAt: string;
  deletedAt: string | null;
  id: string;
  isArchived: boolean;
  kind: CategoryKind;
  name: string;
  updatedAt: string;
  version: number;
}

export interface FinancialAccountSummary {
  createdAt: string;
  deletedAt: string | null;
  id: string;
  isArchived: boolean;
  kind: FinancialAccountKind;
  name: string;
  updatedAt: string;
  version: number;
}

export interface BudgetSummary {
  amount: string;
  categoryId: string | null;
  createdAt: string;
  currency: string;
  deletedAt: string | null;
  id: string;
  month: string;
  updatedAt: string;
  version: number;
}

export interface BudgetProgress {
  amount: string;
  budgetId: string;
  categoryId: string | null;
  categoryName: string | null;
  progress: string;
  remaining: string;
  spent: string;
}

export interface FinanceSummaryResponse {
  budgets: BudgetProgress[];
  currency: string;
  month: string;
  netExpense: string;
  todaySpend: string;
  totalExpense: string;
  totalIncome: string;
  totalRefund: string;
  updatedAt: string;
}

export interface TransactionCreatedResponse {
  duplicateWarning?: {
    code: "POSSIBLE_DUPLICATE";
    matchedTransactionId: string;
    message: string;
  };
  transaction: TransactionSummary;
}

export type DraftStatus = "PENDING" | "CONFIRMED" | "DISCARDED" | "FAILED";
export type ShortcutScope = "transaction:draft:create" | "finance:summary:read";
export type AttachmentScanStatus = "PENDING" | "SCANNED" | "FAILED";

export interface TransactionDraftPayload {
  accountId?: string | null;
  amount: string;
  categoryId?: string | null;
  currency?: string;
  isUnlinkedRefund?: boolean;
  merchant?: string | null;
  note?: string | null;
  occurredAt?: string;
  originalTransactionId?: string | null;
  type: "EXPENSE" | "INCOME" | "REFUND";
}

export interface DraftSummary {
  attachmentId: string | null;
  clientMutationId: string | null;
  confidence: Record<string, number> | null;
  confirmedAt: string | null;
  createdAt: string;
  discardedAt: string | null;
  failureReason: string | null;
  id: string;
  payload: TransactionDraftPayload;
  resultId: string | null;
  source: string;
  status: DraftStatus;
  targetType: "TRANSACTION";
  updatedAt: string;
  version: number;
}

export interface DraftCreatedResponse {
  draft: DraftSummary;
}

export interface DraftListResponse {
  items: DraftSummary[];
  nextCursor: string | null;
}

export interface DraftConfirmResponse {
  draft: DraftSummary;
  transaction: TransactionSummary;
}

export interface DraftBatchDiscardIntentResponse {
  affectedDraftIds: string[];
  confirmationToken: string;
  expiresAt: string;
}

export interface DraftBatchDiscardResult {
  discardedCount: number;
}

export interface ShortcutCredentialSummary {
  createdAt: string;
  id: string;
  lastUsedAt: string | null;
  name: string;
  revokedAt: string | null;
  scopes: ShortcutScope[];
  tokenPrefix: string;
}

export interface ShortcutCredentialCreatedResponse {
  credential: ShortcutCredentialSummary;
  plaintextToken: string;
}

export interface AttachmentUploadIntentResponse {
  expiresAt: string;
  id: string;
  uploadMethod: "PUT";
  uploadToken: string;
  uploadUrl: string;
}

export interface AttachmentSummary {
  createdAt: string;
  deletedAt: string | null;
  id: string;
  mimeType: string;
  ownerId: string | null;
  ownerType: "TRANSACTION_DRAFT";
  scanStatus: AttachmentScanStatus;
  size: number;
  updatedAt: string;
}

export interface AttachmentCompleteResponse {
  attachment: AttachmentSummary;
}

async function http<T>(
  path: string,
  options: { body?: unknown; method?: string } = {},
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      "Content-Type": "application/json",
    },
    method: options.method ?? "GET",
  });

  if (response.status === 204) {
    return undefined as T;
  }
  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      data = null;
    }
  }
  if (!response.ok) {
    const error = (data ?? {}) as ApiErrorBody;
    throw new ApiClientError(
      response.status,
      error.code ?? "SERVICE_UNAVAILABLE",
      error.message ?? "服务暂时不可用，请稍后重试",
      error.fieldErrors,
    );
  }
  return data as T;
}

export const api = {
  completeAttachment(id: string) {
    return http<AttachmentCompleteResponse>(`/attachments/${id}/complete`, {
      method: "POST",
    });
  },
  closeAccount(body: { password: string; reason: string }) {
    return http<void>("/me/close", { body, method: "POST" });
  },
  confirmBatchDiscard(body: { confirmationToken: string }) {
    return http<DraftBatchDiscardResult>("/drafts/batch-discard/confirm", {
      body,
      method: "POST",
    });
  },
  confirmDraft(id: string) {
    return http<DraftConfirmResponse>(`/drafts/${id}/confirm`, {
      method: "POST",
    });
  },
  createBatchDiscard(body: { ids?: string[]; reason: string }) {
    return http<DraftBatchDiscardIntentResponse>("/drafts/batch-discard", {
      body,
      method: "POST",
    });
  },
  forgotPassword(email: string) {
    return http<void>("/auth/forgot-password", {
      body: { email },
      method: "POST",
    });
  },
  getMe() {
    return http<UserSummary>("/me");
  },
  login(body: { email: string; password: string }) {
    return http<AuthSessionResponse>("/auth/login", {
      body,
      method: "POST",
    });
  },
  logout() {
    return http<void>("/auth/logout", { method: "POST" });
  },
  refresh() {
    return http<AuthSessionResponse>("/auth/refresh", { method: "POST" });
  },
  register(body: {
    displayName: string;
    email: string;
    inviteCode?: string;
    password: string;
  }) {
    return http<AuthSessionResponse>("/auth/register", {
      body,
      method: "POST",
    });
  },
  reopenAccount(body: { newPassword: string; recoveryToken: string }) {
    return http<AuthSessionResponse>("/me/reopen", {
      body,
      method: "POST",
    });
  },
  requestDeletion(body: { password: string; reason: string }) {
    return http<void>("/me/request-deletion", {
      body,
      method: "POST",
    });
  },
  resetPassword(body: { newPassword: string; recoveryToken: string }) {
    return http<void>("/auth/reset-password", {
      body,
      method: "POST",
    });
  },
  createBudget(body: {
    amount: string;
    categoryId?: string | null;
    currency?: string;
    month: string;
  }) {
    return http<BudgetSummary>("/budgets", { body, method: "POST" });
  },
  createCategory(body: { color?: string; kind: CategoryKind; name: string }) {
    return http<CategorySummary>("/categories", { body, method: "POST" });
  },
  createFinancialAccount(body: { kind: FinancialAccountKind; name: string }) {
    return http<FinancialAccountSummary>("/financial-accounts", {
      body,
      method: "POST",
    });
  },
  createShortcutCredential(body: { name: string; scopes: ShortcutScope[] }) {
    return http<ShortcutCredentialCreatedResponse>("/shortcut-credentials", {
      body,
      method: "POST",
    });
  },
  createUploadIntent(body: {
    mimeType: string;
    ownerType: "TRANSACTION_DRAFT";
  }) {
    return http<AttachmentUploadIntentResponse>("/attachments/upload-intents", {
      body,
      method: "POST",
    });
  },
  createTransaction(body: {
    accountId?: string | null;
    amount: string;
    categoryId?: string | null;
    clientMutationId?: string | null;
    currency?: string;
    isUnlinkedRefund?: boolean;
    merchant?: string | null;
    note?: string | null;
    occurredAt?: string;
    originalTransactionId?: string | null;
    source?: string;
    type: TransactionType;
  }) {
    return http<TransactionCreatedResponse>("/transactions", {
      body,
      method: "POST",
    });
  },
  deleteBudget(id: string) {
    return http<void>(`/budgets/${id}`, { method: "DELETE" });
  },
  deleteAttachment(id: string) {
    return http<void>(`/attachments/${id}`, { method: "DELETE" });
  },
  discardDraft(id: string) {
    return http<void>(`/drafts/${id}/discard`, { method: "POST" });
  },
  deleteTransaction(id: string) {
    return http<void>(`/transactions/${id}`, { method: "DELETE" });
  },
  exportFinanceCsv(params: { month?: string; type?: TransactionType }) {
    const query = new URLSearchParams();
    if (params.month) {
      query.set("month", params.month);
    }
    if (params.type) {
      query.set("type", params.type);
    }
    const suffix = query.size > 0 ? `?${query.toString()}` : "";
    return fetch(`${API_BASE_URL}/finance/export.csv${suffix}`, {
      credentials: "include",
      headers: {
        Accept: "text/csv",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
    }).then(async (response) => {
      if (!response.ok) {
        const text = await response.text();
        let message = "导出失败";
        try {
          message =
            (JSON.parse(text) as { message?: string }).message ?? message;
        } catch {
          // keep the fallback message
        }
        throw new ApiClientError(response.status, "EXPORT_FAILED", message);
      }
      return { content: await response.text() };
    });
  },
  getFinanceSummary(month?: string) {
    const query = month ? `?month=${encodeURIComponent(month)}` : "";
    return http<FinanceSummaryResponse>(`/finance/summary${query}`);
  },
  getDraft(id: string) {
    return http<DraftSummary>(`/drafts/${id}`);
  },
  getTransaction(id: string) {
    return http<TransactionSummary>(`/transactions/${id}`);
  },
  listBudgets(params: { categoryId?: string; month?: string } = {}) {
    const query = new URLSearchParams();
    if (params.month) {
      query.set("month", params.month);
    }
    if (params.categoryId) {
      query.set("categoryId", params.categoryId);
    }
    const suffix = query.size > 0 ? `?${query.toString()}` : "";
    return http<{ items: BudgetSummary[] }>(`/budgets${suffix}`);
  },
  listCategories(
    params: { includeArchived?: boolean; kind?: CategoryKind } = {},
  ) {
    const query = new URLSearchParams();
    if (params.includeArchived) {
      query.set("includeArchived", "true");
    }
    if (params.kind) {
      query.set("kind", params.kind);
    }
    const suffix = query.size > 0 ? `?${query.toString()}` : "";
    return http<{ items: CategorySummary[] }>(`/categories${suffix}`);
  },
  listDrafts(params: { status?: DraftStatus } = {}) {
    const query = params.status
      ? `?status=${encodeURIComponent(params.status)}`
      : "";
    return http<DraftListResponse>(`/drafts${query}`);
  },
  listFinancialAccounts(params: { includeArchived?: boolean } = {}) {
    const suffix = params.includeArchived ? "?includeArchived=true" : "";
    return http<{ items: FinancialAccountSummary[] }>(
      `/financial-accounts${suffix}`,
    );
  },
  listShortcutCredentials() {
    return http<{ items: ShortcutCredentialSummary[] }>(
      "/shortcut-credentials",
    );
  },
  listTransactions(
    params: {
      accountId?: string;
      categoryId?: string;
      includeDeleted?: boolean;
      limit?: number;
      month?: string;
      type?: TransactionType;
    } = {},
  ) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        query.set(key, String(value));
      }
    }
    const suffix = query.size > 0 ? `?${query.toString()}` : "";
    return http<{ items: TransactionSummary[]; nextCursor: string | null }>(
      `/transactions${suffix}`,
    );
  },
  restoreTransaction(id: string) {
    return http<TransactionSummary>(`/transactions/${id}/restore`, {
      method: "POST",
    });
  },
  revokeShortcutCredential(id: string) {
    return http<void>(`/shortcut-credentials/${id}`, { method: "DELETE" });
  },
  ocrDraft(body: { attachmentId: string; clientMutationId?: string | null }) {
    return http<DraftCreatedResponse>("/drafts/ocr", {
      body,
      method: "POST",
    });
  },
  parseTextDraft(text: string) {
    return http<DraftCreatedResponse>("/drafts/parse-text", {
      body: { text },
      method: "POST",
    });
  },
  updateBudget(
    id: string,
    body: {
      amount?: string;
      categoryId?: string | null;
      currency?: string;
      month?: string;
      version: number;
    },
  ) {
    return http<BudgetSummary>(`/budgets/${id}`, { body, method: "PATCH" });
  },
  updateCategory(
    id: string,
    body: {
      color?: string;
      isArchived?: boolean;
      kind?: CategoryKind;
      name?: string;
      version: number;
    },
  ) {
    return http<CategorySummary>(`/categories/${id}`, {
      body,
      method: "PATCH",
    });
  },
  updateFinancialAccount(
    id: string,
    body: {
      isArchived?: boolean;
      kind?: FinancialAccountKind;
      name?: string;
      version: number;
    },
  ) {
    return http<FinancialAccountSummary>(`/financial-accounts/${id}`, {
      body,
      method: "PATCH",
    });
  },
  updateTransaction(
    id: string,
    body: {
      accountId?: string | null;
      amount?: string;
      categoryId?: string | null;
      currency?: string;
      isUnlinkedRefund?: boolean;
      merchant?: string | null;
      note?: string | null;
      occurredAt?: string;
      originalTransactionId?: string | null;
      source?: string;
      type?: TransactionType;
      version: number;
    },
  ) {
    return http<TransactionCreatedResponse>(`/transactions/${id}`, {
      body,
      method: "PATCH",
    });
  },
  updateDraft(
    id: string,
    body: { payload: TransactionDraftPayload; version: number },
  ) {
    return http<DraftSummary>(`/drafts/${id}`, { body, method: "PATCH" });
  },
  uploadAttachmentContent(id: string, uploadToken: string, data: Blob) {
    return fetch(
      `${API_BASE_URL}/attachments/${id}/content?uploadToken=${encodeURIComponent(uploadToken)}`,
      {
        body: data,
        headers: { "Content-Type": data.type || "application/octet-stream" },
        method: "PUT",
      },
    ).then(async (response) => {
      if (!response.ok) {
        const text = await response.text();
        let message = "上传失败";
        try {
          message =
            (JSON.parse(text) as { message?: string }).message ?? message;
        } catch {
          // keep the fallback message
        }
        throw new ApiClientError(response.status, "UPLOAD_FAILED", message);
      }
    });
  },
};
