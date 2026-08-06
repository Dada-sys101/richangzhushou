import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";

import { AccessTokenGuard } from "../auth/access-token.guard.js";
import { AdminGuard } from "../auth/admin.guard.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import {
  AdminCreateUserDto,
  AdminReasonDto,
  AdminResetPasswordDto,
  UpdateSystemSettingsDto,
} from "../auth/dto/auth.dto.js";
import { AdminService } from "./admin.service.js";

@Controller("admin")
@UseGuards(AccessTokenGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get("dashboard")
  getDashboard() {
    return this.adminService.getDashboard();
  }

  @Get("users")
  async listUsers() {
    return { items: await this.adminService.listUsers() };
  }

  @Post("users")
  @HttpCode(HttpStatus.CREATED)
  createUser(
    @Req() request: AuthenticatedRequest,
    @Body() dto: AdminCreateUserDto,
  ) {
    return this.adminService.createUser(
      request.user!.userId,
      dto,
      request.requestId ?? "unknown",
    );
  }

  @Post("users/:id/reset-password")
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetUserPassword(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() dto: AdminResetPasswordDto,
  ): Promise<void> {
    await this.adminService.resetUserPassword(
      request.user!.userId,
      id,
      dto,
      request.requestId ?? "unknown",
    );
  }

  @Post("users/:id/suspend")
  @HttpCode(HttpStatus.NO_CONTENT)
  async suspendUser(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() dto: AdminReasonDto,
  ): Promise<void> {
    await this.adminService.suspendUser(
      request.user!.userId,
      id,
      dto,
      request.requestId ?? "unknown",
    );
  }

  @Post("users/:id/close")
  @HttpCode(HttpStatus.NO_CONTENT)
  async closeUser(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() dto: AdminReasonDto,
  ): Promise<void> {
    await this.adminService.closeUser(
      request.user!.userId,
      id,
      dto,
      request.requestId ?? "unknown",
    );
  }

  @Post("users/:id/reopen")
  @HttpCode(HttpStatus.NO_CONTENT)
  async reopenUser(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() dto: AdminReasonDto,
  ): Promise<void> {
    await this.adminService.reopenUser(
      request.user!.userId,
      id,
      dto,
      request.requestId ?? "unknown",
    );
  }

  @Post("users/:id/cancel-deletion")
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancelUserDeletion(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() dto: AdminReasonDto,
  ): Promise<void> {
    await this.adminService.cancelUserDeletion(
      request.user!.userId,
      id,
      dto,
      request.requestId ?? "unknown",
    );
  }

  @Get("settings")
  getSettings() {
    return this.adminService.getSettings();
  }

  @Patch("settings")
  updateSettings(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateSystemSettingsDto,
  ) {
    return this.adminService.updateSettings(
      request.user!.userId,
      dto,
      request.requestId ?? "unknown",
    );
  }

  @Get("audits")
  async listAudits() {
    return { items: await this.adminService.listAudits() };
  }

  @Get("health")
  getHealth() {
    return this.adminService.getHealth();
  }
}
