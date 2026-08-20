import "dotenv/config";

import { PrismaService } from "../prisma/prisma.service.js";
import { runAiOriginalInputPurge } from "./ai-original-input-purge.runner.js";

async function main(): Promise<void> {
  process.exitCode = await runAiOriginalInputPurge(
    new PrismaService(),
    console.log,
    console.error,
  );
}

void main();
