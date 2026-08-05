import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { UserOnlyGuard } from "../auth/user-only.guard.js";
import { FinanceController } from "./finance.controller.js";
import { FinanceService } from "./finance.service.js";

@Module({
  controllers: [FinanceController],
  imports: [AuthModule],
  providers: [FinanceService, UserOnlyGuard],
  exports: [FinanceService],
})
export class FinanceModule {}
