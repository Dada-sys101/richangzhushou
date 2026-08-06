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
import {
  CreatePackingItemDto,
  CreateTripDto,
  CreateTripItemDto,
  ListTripsQueryDto,
  UpdatePackingItemDto,
  UpdateTripDto,
  UpdateTripItemDto,
} from "./dto/trips.dto.js";
import { TripsService } from "./trips.service.js";

@Controller()
@UseGuards(AccessTokenGuard, UserOnlyGuard)
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Get("trips")
  list(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListTripsQueryDto,
  ) {
    return this.tripsService.list(this.userId(request), query);
  }

  @Post("trips")
  @HttpCode(HttpStatus.CREATED)
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateTripDto) {
    return this.tripsService.create(this.userId(request), dto);
  }

  @Get("trips/:id")
  get(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.tripsService.get(this.userId(request), id);
  }

  @Patch("trips/:id")
  update(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() dto: UpdateTripDto,
  ) {
    return this.tripsService.update(this.userId(request), id, dto);
  }

  @Delete("trips/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
  ): Promise<void> {
    await this.tripsService.softDelete(this.userId(request), id);
  }

  @Post("trips/:id/restore")
  @HttpCode(HttpStatus.OK)
  restore(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.tripsService.restore(this.userId(request), id);
  }

  @Post("trips/:id/items")
  @HttpCode(HttpStatus.CREATED)
  createItem(
    @Req() request: AuthenticatedRequest,
    @Param("id") tripId: string,
    @Body() dto: CreateTripItemDto,
  ) {
    return this.tripsService.createItem(this.userId(request), tripId, dto);
  }

  @Get("trip-items/:id")
  getTripItem(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.tripsService.getTripItem(this.userId(request), id);
  }

  @Patch("trip-items/:id")
  updateTripItem(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() dto: UpdateTripItemDto,
  ) {
    return this.tripsService.updateItem(this.userId(request), id, dto);
  }

  @Delete("trip-items/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeTripItem(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
  ): Promise<void> {
    await this.tripsService.softDeleteItem(this.userId(request), id);
  }

  @Post("trip-items/:id/restore")
  @HttpCode(HttpStatus.OK)
  restoreTripItem(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
  ) {
    return this.tripsService.restoreItem(this.userId(request), id);
  }

  @Post("trips/:id/packing-items")
  @HttpCode(HttpStatus.CREATED)
  createPackingItem(
    @Req() request: AuthenticatedRequest,
    @Param("id") tripId: string,
    @Body() dto: CreatePackingItemDto,
  ) {
    return this.tripsService.createPackingItem(
      this.userId(request),
      tripId,
      dto,
    );
  }

  @Get("packing-items/:id")
  getPackingItem(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
  ) {
    return this.tripsService.getPackingItem(this.userId(request), id);
  }

  @Patch("packing-items/:id")
  updatePackingItem(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() dto: UpdatePackingItemDto,
  ) {
    return this.tripsService.updatePackingItem(this.userId(request), id, dto);
  }

  @Delete("packing-items/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async removePackingItem(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
  ): Promise<void> {
    await this.tripsService.softDeletePackingItem(this.userId(request), id);
  }

  @Post("packing-items/:id/restore")
  @HttpCode(HttpStatus.OK)
  restorePackingItem(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
  ) {
    return this.tripsService.restorePackingItem(this.userId(request), id);
  }

  private userId(request: AuthenticatedRequest): string {
    if (!request.user) {
      throw new Error("Authenticated request is missing user");
    }
    return request.user.userId;
  }
}
