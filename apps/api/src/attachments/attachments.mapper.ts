import type {
  AttachmentSummary,
  AttachmentOwnerType,
} from "@daily-assistant/api-contracts";

import type { Attachment } from "../generated/prisma/client.js";

export function toAttachmentSummary(row: Attachment): AttachmentSummary {
  return {
    createdAt: row.createdAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
    id: row.id,
    mimeType: row.mimeType,
    ownerId: row.ownerId,
    ownerType: row.ownerType as AttachmentOwnerType,
    scanStatus: row.scanStatus,
    size: row.size,
    updatedAt: row.updatedAt.toISOString(),
  };
}
