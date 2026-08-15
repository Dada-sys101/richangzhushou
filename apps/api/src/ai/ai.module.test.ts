import "reflect-metadata";

import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";

import { AppModule } from "../app.module.js";
import { AuditModule } from "../audit/audit.module.js";
import { CapacityModule } from "../capacity/capacity.module.js";
import { SecurityModule } from "../common/security.module.js";
import { RateLimiterModule } from "../common/rate-limiter.module.js";
import { AiFormalWriteOrchestrator } from "./ai-formal-write.orchestrator.js";
import { AiProposalApplicationPort } from "./ai-proposal.application-port.js";
import { AiProposalController } from "./ai-proposal.controller.js";
import { AiModule } from "./ai.module.js";
import { AiProposalService } from "./ai-proposal.service.js";

describe("PR18 H04 AI module activation", () => {
  it("resolves the controller, concrete port and all formal-write dependencies through existing modules", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        AuditModule,
        CapacityModule,
        RateLimiterModule,
        SecurityModule,
        AiModule,
      ],
    }).compile();

    expect(moduleRef.get(AiProposalController)).toBeInstanceOf(
      AiProposalController,
    );
    const service = moduleRef.get(AiProposalService);
    expect(moduleRef.get(AiProposalApplicationPort)).toBe(service);
    expect(moduleRef.get(AiFormalWriteOrchestrator)).toBeInstanceOf(
      AiFormalWriteOrchestrator,
    );
    await moduleRef.close();
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
