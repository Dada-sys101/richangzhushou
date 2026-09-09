import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";

import { AccessTokenGuard } from "../auth/access-token.guard.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { UserOnlyGuard } from "../auth/user-only.guard.js";
import {
  DeletePushSubscriptionDto,
  SavePushSubscriptionDto,
} from "./dto/push-subscription.dto.js";
import { PushService } from "./push.service.js";

@Controller("push")
@UseGuards(AccessTokenGuard, UserOnlyGuard)
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @Get("status")
  status(@Req() request: AuthenticatedRequest) {
    return this.pushService.status(this.userId(request));
  }

  @Post("subscriptions")
  save(
    @Req() request: AuthenticatedRequest,
    @Body() dto: SavePushSubscriptionDto,
    @Headers("user-agent") userAgent?: string,
  ) {
    return this.pushService.save(this.userId(request), dto, userAgent);
  }

  @Delete("subscriptions")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Req() request: AuthenticatedRequest,
    @Body() dto: DeletePushSubscriptionDto,
  ) {
    return this.pushService.remove(this.userId(request), dto);
  }

  private userId(request: AuthenticatedRequest): string {
    if (!request.user) throw new Error("Authenticated request is missing user");
    return request.user.userId;
  }
}
