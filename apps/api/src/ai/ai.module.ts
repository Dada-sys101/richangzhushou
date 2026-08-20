import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { CalendarModule } from "../calendar/calendar.module.js";
import { FinanceModule } from "../finance/finance.module.js";
import { PrismaModule } from "../prisma/prisma.module.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { RemindersModule } from "../reminders/reminders.module.js";
import { TasksModule } from "../tasks/tasks.module.js";
import { TripsModule } from "../trips/trips.module.js";
import { AiFakeProviderFactory } from "./ai-fake-provider.factory.js";
import {
  AI_FEATURE_GATE_DATABASE_FLAGS,
  AiFeatureGate,
} from "./ai-feature-gate.js";
import { loadDatabaseFeatureFlags } from "./ai-feature-flag-loader.js";
import { AiFormalWriteOrchestrator } from "./ai-formal-write.orchestrator.js";
import { AiProposalApplicationPort } from "./ai-proposal.application-port.js";
import { AiProposalController } from "./ai-proposal.controller.js";
import { AiProposalService } from "./ai-proposal.service.js";
import { AiOriginalInputRetentionService } from "./ai-original-input-retention.service.js";

@Module({
  controllers: [AiProposalController],
  exports: [
    AiProposalApplicationPort,
    AiFeatureGate,
    AiFormalWriteOrchestrator,
    AiProposalService,
    AiOriginalInputRetentionService,
  ],
  imports: [
    AuthModule,
    PrismaModule,
    FinanceModule,
    CalendarModule,
    TasksModule,
    RemindersModule,
    TripsModule,
  ],
  providers: [
    AiFakeProviderFactory,
    {
      provide: AI_FEATURE_GATE_DATABASE_FLAGS,
      inject: [PrismaService],
      useFactory: loadDatabaseFeatureFlags,
    },
    AiFeatureGate,
    AiFormalWriteOrchestrator,
    AiProposalService,
    AiOriginalInputRetentionService,
    {
      provide: AiProposalApplicationPort,
      useExisting: AiProposalService,
    },
  ],
})
export class AiModule {}
