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
import { TasksService } from "./tasks.service.js";
import {
  CreateTaskDto,
  ListTasksQueryDto,
  UpdateTaskDto,
} from "./dto/tasks.dto.js";

@Controller()
@UseGuards(AccessTokenGuard, UserOnlyGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get("tasks")
  list(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListTasksQueryDto,
  ) {
    return this.tasksService.list(this.userId(request), query);
  }

  @Post("tasks")
  @HttpCode(HttpStatus.CREATED)
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateTaskDto) {
    return this.tasksService.create(this.userId(request), dto);
  }

  @Get("tasks/:id")
  get(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.tasksService.get(this.userId(request), id);
  }

  @Patch("tasks/:id")
  update(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasksService.update(this.userId(request), id, dto);
  }

  @Post("tasks/:id/complete")
  @HttpCode(HttpStatus.OK)
  complete(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.tasksService.complete(this.userId(request), id);
  }

  @Delete("tasks/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
  ): Promise<void> {
    await this.tasksService.softDelete(this.userId(request), id);
  }

  @Post("tasks/:id/restore")
  @HttpCode(HttpStatus.OK)
  restore(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.tasksService.restore(this.userId(request), id);
  }

  private userId(request: AuthenticatedRequest): string {
    if (!request.user) {
      throw new Error("Authenticated request is missing user");
    }
    return request.user.userId;
  }
}
