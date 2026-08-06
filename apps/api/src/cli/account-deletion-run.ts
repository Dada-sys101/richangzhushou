import "dotenv/config";

import { AccountDeletionService } from "../account-deletion/account-deletion.service.js";
import { SecurityService } from "../common/security.service.js";
import { LocalStorageAdapter } from "../integrations/local-storage.adapter.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { AuditService } from "../audit/audit.service.js";

async function main(): Promise<void> {
  const prisma = new PrismaService();
  const service = new AccountDeletionService(
    prisma,
    new SecurityService(),
    new AuditService(prisma),
    new LocalStorageAdapter(),
  );
  const result = await service.runCleanup();
  console.log(
    `Account deletion cleanup finished: claimed=${result.claimed} completed=${result.completed} failed=${result.failed}`,
  );
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("Account deletion cleanup failed", error);
  process.exitCode = 1;
});
