import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";

import { AccessTokenGuard } from "../auth/access-token.guard.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { UserOnlyGuard } from "../auth/user-only.guard.js";
import { ApiException } from "../common/api-error.js";
import { AttachmentsService } from "./attachments.service.js";
import { MAX_ATTACHMENT_SIZE, UploadIntentDto } from "./dto/attachments.dto.js";

@Controller()
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Post("attachments/upload-intents")
  @UseGuards(AccessTokenGuard, UserOnlyGuard)
  @HttpCode(HttpStatus.CREATED)
  createUploadIntent(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UploadIntentDto,
  ) {
    return this.attachmentsService.createUploadIntent(
      this.userId(request),
      dto,
    );
  }

  @Put("attachments/:id/content")
  @HttpCode(HttpStatus.NO_CONTENT)
  async uploadContent(
    @Param("id") id: string,
    @Query("uploadToken") uploadToken: string | undefined,
    @Req() request: Request,
  ): Promise<void> {
    if (!uploadToken) {
      throw new ApiException(
        "UPLOAD_TOKEN_INVALID",
        401,
        "Upload token is required",
      );
    }
    const data = await readRawBody(request);
    await this.attachmentsService.storeContent(id, uploadToken, data);
  }

  @Post("attachments/:id/complete")
  @UseGuards(AccessTokenGuard, UserOnlyGuard)
  @HttpCode(HttpStatus.OK)
  completeUpload(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
  ) {
    return this.attachmentsService.completeAttachment(this.userId(request), id);
  }

  @Delete("attachments/:id")
  @UseGuards(AccessTokenGuard, UserOnlyGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAttachment(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
  ): Promise<void> {
    await this.attachmentsService.deleteAttachment(this.userId(request), id);
  }

  private userId(request: AuthenticatedRequest): string {
    if (!request.user) {
      throw new Error("Authenticated request is missing user");
    }
    return request.user.userId;
  }
}

function readRawBody(request: Request): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let settled = false;
    request.on("data", (chunk: Buffer) => {
      if (settled) {
        return;
      }
      size += chunk.length;
      if (size > MAX_ATTACHMENT_SIZE) {
        settled = true;
        reject(
          new ApiException(
            "ATTACHMENT_TOO_LARGE",
            413,
            "Attachment exceeds the size limit",
          ),
        );
        request.resume();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      if (!settled) {
        settled = true;
        resolve(Buffer.concat(chunks));
      }
    });
    request.on("error", (error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    });
  });
}
