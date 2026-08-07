import { Module } from "@nestjs/common";

import { IntegrationsModule } from "../integrations/integrations.module.js";
import { AccountDeletionScheduler } from "./account-deletion.scheduler.js";
import { AccountDeletionService } from "./account-deletion.service.js";

@Module({
  exports: [AccountDeletionService],
  imports: [IntegrationsModule],
  providers: [AccountDeletionScheduler, AccountDeletionService],
})
export class AccountDeletionModule {}
