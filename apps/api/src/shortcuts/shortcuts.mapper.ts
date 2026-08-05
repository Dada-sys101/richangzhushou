import type {
  ShortcutCredentialSummary,
  ShortcutScope,
} from "@daily-assistant/api-contracts";

import type { DeviceCredential } from "../generated/prisma/client.js";

export function toShortcutCredentialSummary(
  row: DeviceCredential,
): ShortcutCredentialSummary {
  return {
    createdAt: row.createdAt.toISOString(),
    id: row.id,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    name: row.name,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    scopes: row.scopes as ShortcutScope[],
    tokenPrefix: row.tokenPrefix,
  };
}
