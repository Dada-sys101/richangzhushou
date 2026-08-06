import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { CalendarModule } from "../calendar/calendar.module.js";
import { DraftsModule } from "../drafts/drafts.module.js";
import { FinanceModule } from "../finance/finance.module.js";
import { RemindersModule } from "../reminders/reminders.module.js";
import { TasksModule } from "../tasks/tasks.module.js";
import { TripsModule } from "../trips/trips.module.js";
import { SyncController } from "./sync.controller.js";
import { SyncService } from "./sync.service.js";

@Module({
  controllers: [SyncController],
  imports: [
    AuthModule,
    CalendarModule,
    DraftsModule,
    FinanceModule,
    RemindersModule,
    TasksModule,
    TripsModule,
  ],
  providers: [SyncService],
})
export class SyncModule {}
