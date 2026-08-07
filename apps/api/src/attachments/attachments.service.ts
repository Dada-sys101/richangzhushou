import { randomUUID } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import type {
  AttachmentCompleteResponse,
  AttachmentUploadIntentResponse,
} from "@daily-assistant/api-contracts";

import { ApiException } from "../common/api-error.js";
import { RateLimiterService } from "../common/rate-limiter.service.js";
import { SecurityService } from "../common/security.service.js";
import {
  STORAGE_ADAPTER,
  type StorageAdapter,
} from "../integrations/integrations.types.js";
import { StorageKeyService } from "../integrations/storage-key.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import {
  MAX_ATTACHMENT_SIZE,
  type UploadIntentDto,
} from "./dto/attachments.dto.js";
import { toAttachmentSummary } from "./attachments.mapper.js";

const UPLOAD_INTENT_TTL_MS = 15 * 60 * 1000;
const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const MAGIC_BYTES: Record<string, (data: Buffer) => boolean> = {
  "image/jpeg": (data) =>
    data.length >= 3 &&
    data[0] === 0xff &&
    data[1] === 0xd8 &&
    data[2] === 0xff,
  "image/png": (data) =>
    data.length >= 8 &&
    data
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  "image/webp": (data) =>
    data.length >= 12 &&
    data.subarray(0, 4).toString("ascii") === "RIFF" &&
    data.subarray(8, 12).toString("ascii") === "WEBP",
};

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly securityService: SecurityService,
    private readonly rateLimiter: RateLimiterService,
    @Inject(STORAGE_ADAPTER) private readonly storageAdapter: StorageAdapter,
    private readonly storageKeyService: StorageKeyService,
  ) {}

  async createUploadIntent(
    userId: string,
    dto: UploadIntentDto,
  ): Promise<AttachmentUploadIntentResponse> {
    const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedMimeTypes.includes(dto.mimeType)) {
      throw new ApiException(
        "ATTACHMENT_TYPE_NOT_ALLOWED",
        400,
        "Attachment type is not allowed",
      );
    }
    const extension = MIME_EXTENSIONS[dto.mimeType];
    const fileId = `${randomUUID()}.${extension}`;
    const objectKey = this.storageKeyService.generateAttachmentKey(
      userId,
      fileId,
    );
    const uploadToken = this.securityService.generateUploadToken();
    const expiresAt = new Date(Date.now() + UPLOAD_INTENT_TTL_MS);
    const row = await this.prisma.attachment.create({
      data: {
        mimeType: dto.mimeType,
        objectKey,
        ownerType: dto.ownerType,
        size: dto.size ?? 0,
        uploadIntentExpiresAt: expiresAt,
        uploadTokenHash: this.securityService.sha256(uploadToken),
        userId,
      },
    });
    return {
      expiresAt: expiresAt.toISOString(),
      id: row.id,
      uploadMethod: "PUT",
      uploadToken,
      uploadUrl: `/api/v1/attachments/${row.id}/content`,
    };
  }

  async storeContent(
    id: string,
    uploadToken: string,
    data: Buffer,
  ): Promise<void> {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id },
    });
    if (!attachment || attachment.deletedAt) {
      throw new ApiException(
        "UPLOAD_TOKEN_INVALID",
        401,
        "Upload token is invalid",
      );
    }
    if (
      attachment.uploadTokenHash !== this.securityService.sha256(uploadToken)
    ) {
      throw new ApiException(
        "UPLOAD_TOKEN_INVALID",
        401,
        "Upload token is invalid",
      );
    }
    if (
      attachment.uploadIntentExpiresAt &&
      attachment.uploadIntentExpiresAt <= new Date()
    ) {
      throw new ApiException(
        "UPLOAD_INTENT_EXPIRED",
        410,
        "Upload intent has expired",
      );
    }
    if (attachment.contentStoredAt) {
      throw new ApiException(
        "INVALID_STATE",
        409,
        "Attachment content was already uploaded",
      );
    }
    if (data.length > MAX_ATTACHMENT_SIZE) {
      throw new ApiException(
        "ATTACHMENT_TOO_LARGE",
        413,
        "Attachment exceeds the size limit",
      );
    }
    const matchesMagic = MAGIC_BYTES[attachment.mimeType];
    if (!matchesMagic || !matchesMagic(data)) {
      throw new ApiException(
        "ATTACHMENT_TYPE_NOT_ALLOWED",
        400,
        "Attachment content does not match the declared type",
      );
    }
    this.rateLimiter.consume(`upload:${attachment.userId}`, 60, 60_000);

    await this.storageAdapter.put(
      attachment.objectKey,
      data,
      attachment.mimeType,
    );
    const updated = await this.prisma.attachment.updateMany({
      data: {
        contentStoredAt: new Date(),
        sha256: this.securityService.sha256Buffer(data),
        size: data.length,
      },
      where: {
        contentStoredAt: null,
        id,
        uploadTokenHash: this.securityService.sha256(uploadToken),
      },
    });
    if (updated.count === 0) {
      throw new ApiException(
        "INVALID_STATE",
        409,
        "Attachment content was already uploaded",
      );
    }
  }

  async completeAttachment(
    userId: string,
    id: string,
  ): Promise<AttachmentCompleteResponse> {
    const attachment = await this.prisma.attachment.findFirst({
      where: { deletedAt: null, id, userId },
    });
    if (!attachment) {
      throw new ApiException("RESOURCE_NOT_FOUND", 404, "Attachment not found");
    }
    if (!attachment.contentStoredAt) {
      throw new ApiException(
        "INVALID_STATE",
        409,
        "Attachment content must be uploaded before completion",
      );
    }
    return { attachment: toAttachmentSummary(attachment) };
  }

  async deleteAttachment(userId: string, id: string): Promise<void> {
    const attachment = await this.prisma.attachment.findFirst({
      where: { deletedAt: null, id, userId },
    });
    if (!attachment) {
      throw new ApiException("RESOURCE_NOT_FOUND", 404, "Attachment not found");
    }
    await this.prisma.attachment.updateMany({
      data: { deletedAt: new Date() },
      where: { deletedAt: null, id, userId },
    });
    try {
      await this.storageAdapter.delete(attachment.objectKey);
    } catch {
      // Object cleanup is best-effort; the database record is already soft-deleted.
    }
  }
}
