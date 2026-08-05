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
  const data = text ? (JSON.parse(text) as unknown) : null;
  if (!response.ok) {
    const error = data as ApiErrorBody;
    throw new ApiClientError(
      response.status,
      error.code ?? "INTERNAL_ERROR",
      error.message ?? "Request failed",
      error.fieldErrors,
    );
  }
  return data as T;
}

export const api = {
  closeAccount(body: { password: string; reason: string }) {
    return http<void>("/me/close", { body, method: "POST" });
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
};
