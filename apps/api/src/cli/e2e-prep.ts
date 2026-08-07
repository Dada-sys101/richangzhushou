import "dotenv/config";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";

import { PrismaClient } from "../generated/prisma/client.js";

async function main(): Promise<void> {
  const databaseUrl =
    process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL ?? "";
  if (!databaseUrl) {
    console.error(
      "E2E database preparation requires E2E_DATABASE_URL (or DATABASE_URL in CI).",
    );
    process.exitCode = 2;
    return;
  }
  const prisma = new PrismaClient({
    adapter: new PrismaMariaDb(databaseUrl),
  });
  await prisma.systemSetting.upsert({
    create: { id: "singleton", maxActiveUsers: 500 },
    update: { maxActiveUsers: 500 },
    where: { id: "singleton" },
  });
  await prisma.$disconnect();
  console.log("E2E database prepared: maxActiveUsers=500");
}

main().catch((error) => {
  console.error("E2E database preparation failed", error);
  process.exitCode = 1;
});
