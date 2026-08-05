import type {
  DraftSummary,
  TransactionDraftPayload,
} from "@daily-assistant/api-contracts";

import type { DraftRecord } from "../generated/prisma/client.js";

export function toDraftSummary(row: DraftRecord): DraftSummary {
  return {
    attachmentId: row.attachmentId,
    clientMutationId: row.clientMutationId,
    confidence: (row.confidenceJson as Record<string, number> | null) ?? null,
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    discardedAt: row.discardedAt?.toISOString() ?? null,
    failureReason: row.failureReason,
    id: row.id,
    payload: row.payloadJson as unknown as TransactionDraftPayload,
    resultId: row.resultId,
    source: row.source,
    status: row.status,
    targetType: row.targetType,
    updatedAt: row.updatedAt.toISOString(),
    version: row.version,
  };
}
