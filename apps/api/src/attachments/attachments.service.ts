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
  SCAN_ADAPTER,
  STORAGE_ADAPTER,
  type ScanAdapter,
  type StorageAdapter,
} from "../integrations/integrations.types.js";
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

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly securityService: SecurityService,
    private readonly rateLimiter: RateLimiterService,
    @Inject(STORAGE_ADAPTER) private readonly storageAdapter: StorageAdapter,
    @Inject(SCAN_ADAPTER) private readonly scanAdapter: ScanAdapter,
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
    const objectKey = `attachments/${userId}/${randomUUID()}.${extension}`;
    const uploadToken = this.securityService.generateUploadToken();
    const expiresAt = new Date(Date.now() + UPLOAD_INTENT_TTL_MS);
    const row = await this.prisma.attachment.create({
      data: {
        mimeType: dto.mimeType,
        objectKey,
        ownerType: dto.ownerType,
        scanStatus: "PENDING",
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
        "ATTACHMENT_NOT_READY",
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
        "ATTACHMENT_NOT_READY",
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
        "ATTACHMENT_NOT_READY",
        409,
        "Attachment content must be uploaded before completion",
      );
    }
    if (attachment.scanStatus === "SCANNED") {
      return { attachment: toAttachmentSummary(attachment) };
    }
    if (attachment.scanStatus === "FAILED") {
      throw new ApiException(
        "ATTACHMENT_SCAN_FAILED",
        422,
        "Attachment scan did not pass",
      );
    }

    const data = await this.storageAdapter.get(attachment.objectKey);
    const scanResult = await this.scanAdapter.scan(data, attachment.mimeType);
    if (scanResult.status === "FAILED") {
      await this.prisma.attachment.updateMany({
        data: { scanStatus: "FAILED" },
        where: { id, userId },
      });
      throw new ApiException(
        "ATTACHMENT_SCAN_FAILED",
        422,
        "Attachment scan did not pass",
      );
    }
    const updated = await this.prisma.attachment.update({
      data: { scanStatus: "SCANNED" },
      where: { id },
    });
    return { attachment: toAttachmentSummary(updated) };
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
