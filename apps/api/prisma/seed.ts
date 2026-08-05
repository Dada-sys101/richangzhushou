import "dotenv/config";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";

import { PrismaClient } from "../src/generated/prisma/client.js";

const DEFAULT_DATABASE_URL =
  "mysql://daily_assistant:local-validation-only@127.0.0.1:3306/daily_assistant";

async function main(): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaMariaDb(
      process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
    ),
  });
  const settings = await prisma.systemSetting.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      inviteRequired: true,
      maxActiveUsers: 20,
      registrationEnabled: false,
    },
    update: {},
  });
  console.log(
    `SystemSetting ready: registration=${settings.registrationEnabled}, inviteRequired=${settings.inviteRequired}, maxActiveUsers=${settings.maxActiveUsers}`,
  );
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("Seed failed", error);
  process.exitCode = 1;
});
