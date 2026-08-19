import "dotenv/config";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";

import { PrismaClient } from "../generated/prisma/client.js";

const E2E_FEATURE_FLAGS = {
  "v15.ai.businessWrite": true,
  "v15.ai.fakeProvider": true,
  "v15.ai.liveProvider": false,
  "v15.ai.proposal": true,
};

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
    create: {
      featureFlags: E2E_FEATURE_FLAGS,
      id: "singleton",
      maxActiveUsers: 500,
    },
    update: {
      featureFlags: E2E_FEATURE_FLAGS,
      maxActiveUsers: 500,
    },
    where: { id: "singleton" },
  });
  await prisma.$disconnect();
  console.log(
    "E2E database prepared: maxActiveUsers=500, AI Fake Provider flags enabled",
  );
}

main().catch((error) => {
  console.error("E2E database preparation failed", error);
  process.exitCode = 1;
});
