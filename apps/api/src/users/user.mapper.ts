import type { UserSummary } from "@daily-assistant/api-contracts";

import type { User } from "../generated/prisma/client.js";

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function toUserSummary(user: User): UserSummary {
  return {
    closedAt: user.closedAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    deletionRequestedAt: user.deletionRequestedAt?.toISOString() ?? null,
    displayName: user.displayName,
    id: user.id,
    role: user.role,
    status: user.status,
    updatedAt: user.updatedAt.toISOString(),
    username: user.username,
  };
}
