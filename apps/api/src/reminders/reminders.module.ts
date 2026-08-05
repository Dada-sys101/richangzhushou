import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { IntegrationsModule } from "../integrations/integrations.module.js";
import { RemindersController } from "./reminders.controller.js";
import { RemindersScheduler } from "./reminders.scheduler.js";
import { RemindersService } from "./reminders.service.js";

@Module({
  controllers: [RemindersController],
  exports: [RemindersService, RemindersScheduler],
  imports: [AuthModule, IntegrationsModule],
  providers: [RemindersScheduler, RemindersService],
})
export class RemindersModule {}
