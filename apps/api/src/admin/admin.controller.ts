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
  AdminReasonDto,
  InviteCreateDto,
  UpdateRegistrationSettingsDto,
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

  @Get("invites")
  async listInvites() {
    return { items: await this.adminService.listInvites() };
  }

  @Post("invites")
  @HttpCode(HttpStatus.CREATED)
  createInvite(
    @Req() request: AuthenticatedRequest,
    @Body() dto: InviteCreateDto,
  ) {
    return this.adminService.createInvite(
      request.user!.userId,
      dto,
      request.requestId ?? "unknown",
    );
  }

  @Post("invites/:id/revoke")
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeInvite(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() dto: AdminReasonDto,
  ): Promise<void> {
    await this.adminService.revokeInvite(
      request.user!.userId,
      id,
      dto,
      request.requestId ?? "unknown",
    );
  }

  @Get("users")
  async listUsers() {
    return { items: await this.adminService.listUsers() };
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

  @Get("settings/registration")
  getSettings() {
    return this.adminService.getSettings();
  }

  @Patch("settings/registration")
  updateSettings(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateRegistrationSettingsDto,
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
