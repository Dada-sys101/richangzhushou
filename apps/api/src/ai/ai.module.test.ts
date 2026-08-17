import "reflect-metadata";

import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";

import { AppModule } from "../app.module.js";
import { AuditModule } from "../audit/audit.module.js";
import { CapacityModule } from "../capacity/capacity.module.js";
import { SecurityModule } from "../common/security.module.js";
import { RateLimiterModule } from "../common/rate-limiter.module.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { AiFormalWriteOrchestrator } from "./ai-formal-write.orchestrator.js";
import { AiFeatureGate } from "./ai-feature-gate.js";
import { AiProposalApplicationPort } from "./ai-proposal.application-port.js";
import { AiProposalController } from "./ai-proposal.controller.js";
import { AiModule } from "./ai.module.js";
import { AiProposalService } from "./ai-proposal.service.js";

describe("PR18 H04 AI module activation", () => {
  it("resolves the controller, concrete port and all formal-write dependencies through existing modules", async () => {
    const previousAi = process.env.V15_AI_ALLOWED;
    const previousLiveAi = process.env.V15_LIVE_AI_ALLOWED;
    process.env.V15_AI_ALLOWED = "true";
    delete process.env.V15_LIVE_AI_ALLOWED;
    const findUnique = vi.fn().mockResolvedValue({
      featureFlags: {
        "v15.ai.businessWrite": true,
        "v15.ai.fakeProvider": true,
        "v15.ai.liveProvider": false,
        "v15.ai.proposal": true,
      },
    });
    const prisma = {
      systemSetting: { findUnique },
    } as unknown as PrismaService;
    const moduleBuilder = Test.createTestingModule({
      imports: [
        AuditModule,
        CapacityModule,
        RateLimiterModule,
        SecurityModule,
        AiModule,
      ],
    });
    moduleBuilder.overrideProvider(PrismaService).useValue(prisma);
    const moduleRef = await moduleBuilder.compile();
    try {
      expect(moduleRef.get(AiProposalController)).toBeInstanceOf(
        AiProposalController,
      );
      const service = moduleRef.get(AiProposalService);
      expect(moduleRef.get(AiProposalApplicationPort)).toBe(service);
      expect(moduleRef.get(AiFormalWriteOrchestrator)).toBeInstanceOf(
        AiFormalWriteOrchestrator,
      );
      const featureGate = moduleRef.get(AiFeatureGate);
      expect(featureGate.isProposalEnabled()).toBe(true);
      expect(featureGate.isFakeProviderEnabled()).toBe(true);
      expect(featureGate.isBusinessWriteEnabled()).toBe(true);
      expect(featureGate.isLiveProviderEnabled()).toBe(false);
      expect(findUnique).toHaveBeenCalledWith({
        select: { featureFlags: true },
        where: { id: "singleton" },
      });
    } finally {
      await moduleRef.close();
      if (previousAi === undefined) {
        delete process.env.V15_AI_ALLOWED;
      } else {
        process.env.V15_AI_ALLOWED = previousAi;
      }
      if (previousLiveAi === undefined) {
        delete process.env.V15_LIVE_AI_ALLOWED;
      } else {
        process.env.V15_LIVE_AI_ALLOWED = previousLiveAi;
      }
    }
  });

  it("adds AiModule to AppModule without creating an alternative route", () => {
    const importedModules = Reflect.getMetadata(
      "imports",
      AppModule,
    ) as unknown[];
    expect(importedModules).toContain(AiModule);
    expect(Reflect.getMetadata("controllers", AiModule)).toEqual([
      AiProposalController,
    ]);
  });
});
