import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";

import { AccessTokenGuard } from "../auth/access-token.guard.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { UserOnlyGuard } from "../auth/user-only.guard.js";
import { RemindersService } from "./reminders.service.js";
import {
  CreateReminderDto,
  ListRemindersQueryDto,
  UpdateReminderDto,
} from "./dto/reminders.dto.js";

@Controller()
@UseGuards(AccessTokenGuard, UserOnlyGuard)
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  @Get("reminders")
  list(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListRemindersQueryDto,
  ) {
    return this.remindersService.list(this.userId(request), query);
  }

  @Post("reminders")
  @HttpCode(HttpStatus.CREATED)
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateReminderDto) {
    return this.remindersService.create(this.userId(request), dto);
  }

  @Get("reminders/:id")
  get(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.remindersService.get(this.userId(request), id);
  }

  @Patch("reminders/:id")
  update(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() dto: UpdateReminderDto,
  ) {
    return this.remindersService.update(this.userId(request), id, dto);
  }

  @Delete("reminders/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
  ): Promise<void> {
    await this.remindersService.softDelete(this.userId(request), id);
  }

  @Post("reminders/:id/restore")
  @HttpCode(HttpStatus.OK)
  restore(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.remindersService.restore(this.userId(request), id);
  }

  private userId(request: AuthenticatedRequest): string {
    if (!request.user) {
      throw new Error("Authenticated request is missing user");
    }
    return request.user.userId;
  }
}
