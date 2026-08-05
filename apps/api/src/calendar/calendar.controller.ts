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
import { CalendarService } from "./calendar.service.js";
import {
  CreateCalendarEventDto,
  ListCalendarEventsQueryDto,
  UpdateCalendarEventDto,
} from "./dto/calendar.dto.js";

@Controller()
@UseGuards(AccessTokenGuard, UserOnlyGuard)
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get("calendar-events")
  list(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListCalendarEventsQueryDto,
  ) {
    return this.calendarService.list(this.userId(request), query);
  }

  @Post("calendar-events")
  @HttpCode(HttpStatus.CREATED)
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateCalendarEventDto,
  ) {
    return this.calendarService.create(this.userId(request), dto);
  }

  @Get("calendar-events/:id")
  get(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.calendarService.get(this.userId(request), id);
  }

  @Patch("calendar-events/:id")
  update(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() dto: UpdateCalendarEventDto,
  ) {
    return this.calendarService.update(this.userId(request), id, dto);
  }

  @Delete("calendar-events/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
  ): Promise<void> {
    await this.calendarService.softDelete(this.userId(request), id);
  }

  @Post("calendar-events/:id/restore")
  @HttpCode(HttpStatus.OK)
  restore(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.calendarService.restore(this.userId(request), id);
  }

  private userId(request: AuthenticatedRequest): string {
    if (!request.user) {
      throw new Error("Authenticated request is missing user");
    }
    return request.user.userId;
  }
}
