import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { CalendarModule } from "../calendar/calendar.module.js";
import { FinanceModule } from "../finance/finance.module.js";
import { PrismaModule } from "../prisma/prisma.module.js";
import { RemindersModule } from "../reminders/reminders.module.js";
import { TasksModule } from "../tasks/tasks.module.js";
import { TripsModule } from "../trips/trips.module.js";
import { AiFakeProviderFactory } from "./ai-fake-provider.factory.js";
import { AiFeatureGate } from "./ai-feature-gate.js";
import { AiFormalWriteOrchestrator } from "./ai-formal-write.orchestrator.js";
import { AiProposalApplicationPort } from "./ai-proposal.application-port.js";
import { AiProposalController } from "./ai-proposal.controller.js";
import { AiProposalService } from "./ai-proposal.service.js";

@Module({
  controllers: [AiProposalController],
  exports: [
    AiProposalApplicationPort,
    AiFeatureGate,
    AiFormalWriteOrchestrator,
    AiProposalService,
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
    AiFeatureGate,
    AiFormalWriteOrchestrator,
    AiProposalService,
    {
      provide: AiProposalApplicationPort,
      useExisting: AiProposalService,
    },
  ],
})
export class AiModule {}
