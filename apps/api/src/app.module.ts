import { Module } from "@nestjs/common";

import { AccountModule } from "./account/account.module.js";
import { AdminModule } from "./admin/admin.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { AuditModule } from "./audit/audit.module.js";
import { CapacityModule } from "./capacity/capacity.module.js";
import { RateLimiterModule } from "./common/rate-limiter.module.js";
import { SecurityModule } from "./common/security.module.js";
import { HealthController } from "./health/health.controller.js";
import { MailModule } from "./mail/mail.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";

@Module({
  imports: [
    AccountModule,
    AdminModule,
    AuditModule,
    AuthModule,
    CapacityModule,
    MailModule,
    PrismaModule,
    RateLimiterModule,
    SecurityModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
