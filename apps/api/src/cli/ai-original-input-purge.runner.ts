import { AiOriginalInputRetentionService } from "../ai/ai-original-input-retention.service.js";
import type { PrismaService } from "../prisma/prisma.service.js";

export interface AiOriginalInputPurgePrisma {
  $disconnect(): Promise<void>;
  aiRequest: PrismaService["aiRequest"];
}

export async function runAiOriginalInputPurge(
  prisma: AiOriginalInputPurgePrisma,
  writeStatus: (message: string) => void,
  writeError: (message: string) => void,
): Promise<number> {
  try {
    const service = new AiOriginalInputRetentionService(
      prisma as PrismaService,
    );
    const result = await service.purgeExpired();
    writeStatus(`AI original-input purge completed: purged=${result.purged}`);
    return 0;
  } catch {
    writeError("AI original-input purge failed");
    return 1;
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}
