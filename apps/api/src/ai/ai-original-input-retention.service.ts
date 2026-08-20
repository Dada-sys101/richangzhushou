import { Inject, Injectable, Optional } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service.js";

export interface AiOriginalInputPurgeResult {
  purged: number;
}

export const AI_ORIGINAL_INPUT_RETENTION_CLOCK = Symbol(
  "AI_ORIGINAL_INPUT_RETENTION_CLOCK",
);

@Injectable()
export class AiOriginalInputRetentionService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    @Inject(AI_ORIGINAL_INPUT_RETENTION_CLOCK)
    private readonly clock: { now(): Date } = { now: () => new Date() },
  ) {}

  async purgeExpired(
    now = this.clock.now(),
  ): Promise<AiOriginalInputPurgeResult> {
    const result = await this.prisma.aiRequest.updateMany({
      data: {
        originalInputExpiresAt: null,
        originalUserInput: null,
      },
      where: {
        originalInputExpiresAt: { lte: now },
        originalUserInput: { not: null },
      },
    });
    return { purged: result.count };
  }
}
