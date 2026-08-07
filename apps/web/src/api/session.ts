export const API_BASE_URL = "/api/v1";

let accessToken: string | null = null;
let refreshInFlight: Promise<AuthSessionResponse | null> | null = null;

export interface AuthSessionResponse {
  accessToken: string;
  expiresIn: number;
  mustChangePassword: boolean;
  user: {
    closedAt: string | null;
    createdAt: string;
    deletionRequestedAt: string | null;
    displayName: string;
    id: string;
    role: "ADMIN" | "USER";
    status:
      | "ACTIVE"
      | "CLOSED"
      | "DELETED"
      | "DELETION_PENDING"
      | "DELETION_PROCESSING"
      | "SUSPENDED";
    updatedAt: string;
    username: string;
  };
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

/** Single-flight refresh so concurrent 401 retries and route guards cannot race each other's rotation. */
export function refreshSessionOnce(): Promise<AuthSessionResponse | null> {
  if (!refreshInFlight) {
    refreshInFlight = performRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function performRefresh(): Promise<AuthSessionResponse | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      credentials: "include",
      method: "POST",
    });
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as AuthSessionResponse;
    setAccessToken(data.accessToken);
    return data;
  } catch {
    return null;
  }
}
