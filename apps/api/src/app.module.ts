import { Module } from "@nestjs/common";

import { AccountModule } from "./account/account.module.js";
import { AdminModule } from "./admin/admin.module.js";
import { AttachmentsModule } from "./attachments/attachments.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { AuditModule } from "./audit/audit.module.js";
import { CapacityModule } from "./capacity/capacity.module.js";
import { RateLimiterModule } from "./common/rate-limiter.module.js";
import { SecurityModule } from "./common/security.module.js";
import { DraftsModule } from "./drafts/drafts.module.js";
import { FinanceModule } from "./finance/finance.module.js";
import { HealthController } from "./health/health.controller.js";
import { IntegrationsModule } from "./integrations/integrations.module.js";
import { MailModule } from "./mail/mail.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";
import { ShortcutsModule } from "./shortcuts/shortcuts.module.js";

@Module({
  imports: [
    AccountModule,
    AdminModule,
    AttachmentsModule,
    AuditModule,
    AuthModule,
    CapacityModule,
    DraftsModule,
    FinanceModule,
    IntegrationsModule,
    MailModule,
    PrismaModule,
    RateLimiterModule,
    SecurityModule,
    ShortcutsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
