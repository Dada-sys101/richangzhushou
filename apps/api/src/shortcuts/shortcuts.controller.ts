import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";

import { AccessTokenGuard } from "../auth/access-token.guard.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { UserOnlyGuard } from "../auth/user-only.guard.js";
import { ApiException } from "../common/api-error.js";
import { DeviceCredentialGuard } from "./device-credential.guard.js";
import {
  CreateShortcutCredentialDto,
  ShortcutTransactionDraftDto,
} from "./dto/shortcuts.dto.js";
import { RequireShortcutScope } from "./shortcut-scope.decorator.js";
import { ShortcutsService } from "./shortcuts.service.js";

@Controller()
export class ShortcutsController {
  constructor(private readonly shortcutsService: ShortcutsService) {}

  @Post("shortcut-credentials")
  @UseGuards(AccessTokenGuard, UserOnlyGuard)
  @HttpCode(HttpStatus.CREATED)
  createCredential(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateShortcutCredentialDto,
  ) {
    return this.shortcutsService.createCredential(this.userId(request), dto);
  }

  @Get("shortcut-credentials")
  @UseGuards(AccessTokenGuard, UserOnlyGuard)
  listCredentials(@Req() request: AuthenticatedRequest) {
    return this.shortcutsService.listCredentials(this.userId(request));
  }

  @Delete("shortcut-credentials/:id")
  @UseGuards(AccessTokenGuard, UserOnlyGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeCredential(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
  ): Promise<void> {
    await this.shortcutsService.revokeCredential(this.userId(request), id);
  }

  @Post("shortcuts/transaction-drafts")
  @UseGuards(DeviceCredentialGuard)
  @RequireShortcutScope("transaction:draft:create")
  @HttpCode(HttpStatus.CREATED)
  createTransactionDraft(
    @Req() request: AuthenticatedRequest,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body() dto: ShortcutTransactionDraftDto,
  ) {
    if (!idempotencyKey) {
      throw new ApiException(
        "VALIDATION_ERROR",
        400,
        "Idempotency-Key header is required",
        [{ field: "Idempotency-Key", message: "缺少幂等键" }],
      );
    }
    return this.shortcutsService.createTransactionDraft(
      this.userId(request),
      dto,
      idempotencyKey,
    );
  }

  @Get("shortcuts/today-spend")
  @UseGuards(DeviceCredentialGuard)
  @RequireShortcutScope("finance:summary:read")
  todaySpend(@Req() request: AuthenticatedRequest) {
    return this.shortcutsService.todaySpend(this.userId(request));
  }

  private userId(request: AuthenticatedRequest): string {
    if (!request.user) {
      throw new Error("Authenticated request is missing user");
    }
    return request.user.userId;
  }
}
