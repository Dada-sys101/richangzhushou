export const API_BASE_URL = "/api/v1";

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export interface AuthSessionResponse {
  accessToken: string;
  expiresIn: number;
  user: AdminUserSummary;
}

export interface AdminUserSummary {
  closedAt: string | null;
  createdAt: string;
  deletionRequestedAt: string | null;
  id: string;
  maskedEmail: string;
  role: "ADMIN" | "USER";
  status: string;
}

export interface InviteSummary {
  codePrefix: string;
  createdAt: string;
  expiresAt: string | null;
  id: string;
  maxUses: number;
  revokedAt: string | null;
  status: string;
  usedCount: number;
}

export interface InviteCreatedResponse {
  invite: InviteSummary;
  plaintextCode: string;
}

export interface RegistrationSettings {
  inviteRequired: boolean;
  maxActiveUsers: number;
  registrationEnabled: boolean;
}

export interface AdminDashboardResponse extends RegistrationSettings {
  activeUsers: number;
  occupiedSlots: number;
  remainingSlots: number;
  suspendedUsers: number;
}

export interface AdminAuditEntry {
  action: string;
  actorEmail: string | null;
  changes: Record<string, unknown>;
  createdAt: string;
  id: string;
  reason: string;
  requestId: string;
  targetId: string | null;
  targetType: string;
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
    const error = (data ?? {}) as { code?: string; message?: string };
    throw new ApiClientError(
      response.status,
      error.code ?? "SERVICE_UNAVAILABLE",
      error.message ?? "服务暂时不可用，请稍后重试",
    );
  }
  return data as T;
}

export const adminApi = {
  createInvite(body: {
    expiresAt?: string | null;
    maxUses: number;
    reason: string;
  }) {
    return http<InviteCreatedResponse>("/admin/invites", {
      body,
      method: "POST",
    });
  },
  getAudits() {
    return http<{ items: AdminAuditEntry[] }>("/admin/audits");
  },
  getDashboard() {
    return http<AdminDashboardResponse>("/admin/dashboard");
  },
  getHealth() {
    return http<{ database: string; status: string }>("/admin/health");
  },
  getSettings() {
    return http<RegistrationSettings>("/admin/settings/registration");
  },
  listInvites() {
    return http<{ items: InviteSummary[] }>("/admin/invites");
  },
  listUsers() {
    return http<{ items: AdminUserSummary[] }>("/admin/users");
  },
  login(email: string, password: string) {
    return http<AuthSessionResponse>("/auth/login", {
      body: { email, password },
      method: "POST",
    });
  },
  logout() {
    return http<void>("/auth/logout", { method: "POST" });
  },
  refresh() {
    return http<AuthSessionResponse>("/auth/refresh", { method: "POST" });
  },
  revokeInvite(id: string, reason: string) {
    return http<void>(`/admin/invites/${id}/revoke`, {
      body: { reason },
      method: "POST",
    });
  },
  updateSettings(body: {
    inviteRequired?: boolean;
    maxActiveUsers?: number;
    reason: string;
    registrationEnabled?: boolean;
  }) {
    return http<RegistrationSettings>("/admin/settings/registration", {
      body,
      method: "PATCH",
    });
  },
  userAction(
    userId: string,
    action: "close" | "reopen" | "suspend",
    reason: string,
  ) {
    return http<void>(`/admin/users/${userId}/${action}`, {
      body: { reason },
      method: "POST",
    });
  },
};
