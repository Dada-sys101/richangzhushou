import type { UserSummary } from "@daily-assistant/api-contracts";

import type { User } from "../generated/prisma/client.js";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function maskEmail(email: string): string {
  const [localRaw, domain] = email.split("@");
  const local = localRaw ?? "";
  if (!domain) {
    return "***";
  }
  const visible = local.length <= 2 ? (local[0] ?? "") : local.slice(0, 2);
  return `${visible}***@${domain}`;
}

export function toUserSummary(user: User): UserSummary {
  return {
    closedAt: user.closedAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    deletionRequestedAt: user.deletionRequestedAt?.toISOString() ?? null,
    displayName: user.displayName,
    email: user.email,
    id: user.id,
    role: user.role,
    status: user.status,
    updatedAt: user.updatedAt.toISOString(),
  };
}
