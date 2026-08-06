import { Module } from "@nestjs/common";

import { AccountDeletionModule } from "./account-deletion/account-deletion.module.js";
import { AccountModule } from "./account/account.module.js";
import { AdminModule } from "./admin/admin.module.js";
import { AttachmentsModule } from "./attachments/attachments.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { AuditModule } from "./audit/audit.module.js";
import { CalendarModule } from "./calendar/calendar.module.js";
import { CapacityModule } from "./capacity/capacity.module.js";
import { RateLimiterModule } from "./common/rate-limiter.module.js";
import { SecurityModule } from "./common/security.module.js";
import { DraftsModule } from "./drafts/drafts.module.js";
import { FinanceModule } from "./finance/finance.module.js";
import { HealthController } from "./health/health.controller.js";
import { IntegrationsModule } from "./integrations/integrations.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";
import { RemindersModule } from "./reminders/reminders.module.js";
import { ShortcutsModule } from "./shortcuts/shortcuts.module.js";
import { SyncModule } from "./sync/sync.module.js";
import { TasksModule } from "./tasks/tasks.module.js";
import { TripsModule } from "./trips/trips.module.js";

@Module({
  imports: [
    AccountDeletionModule,
    AccountModule,
    AdminModule,
    AttachmentsModule,
    AuditModule,
    AuthModule,
    CalendarModule,
    CapacityModule,
    DraftsModule,
    FinanceModule,
    IntegrationsModule,
    PrismaModule,
    RateLimiterModule,
    RemindersModule,
    SecurityModule,
    ShortcutsModule,
    SyncModule,
    TasksModule,
    TripsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
