import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { TripsController } from "./trips.controller.js";
import { TripsService } from "./trips.service.js";

@Module({
  controllers: [TripsController],
  imports: [AuthModule],
  providers: [TripsService],
})
export class TripsModule {}
