import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { FinanceModule } from "../finance/finance.module.js";
import { IntegrationsModule } from "../integrations/integrations.module.js";
import { DraftsController } from "./drafts.controller.js";
import { DraftsService } from "./drafts.service.js";

@Module({
  controllers: [DraftsController],
  exports: [DraftsService],
  imports: [AuthModule, FinanceModule, IntegrationsModule],
  providers: [DraftsService],
})
export class DraftsModule {}
