import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { AdminController } from "./admin.controller.js";
import { AdminService } from "./admin.service.js";

@Module({
  controllers: [AdminController],
  imports: [AuthModule],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
