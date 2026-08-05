import "dotenv/config";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { hash } from "argon2";

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

  if (process.env.SEED_DEMO_USER === "true") {
    await seedDemoUser(prisma);
  }
  await prisma.$disconnect();
}

async function seedDemoUser(prisma: PrismaClient): Promise<void> {
  const demoEmail = process.env.DEMO_USER_EMAIL ?? "demo@example.com";
  const demoPassword = process.env.DEMO_USER_PASSWORD ?? "DemoUser123!";
  const passwordHash = await hash(demoPassword, { type: 2 });
  const normalizedEmail = demoEmail.trim().toLowerCase();

  const user = await prisma.user.upsert({
    where: { normalizedEmail },
    create: {
      displayName: "演示用户",
      email: demoEmail.trim(),
      normalizedEmail,
      passwordHash,
      role: "USER",
      status: "ACTIVE",
    },
    update: {},
  });

  const categories = [
    { kind: "EXPENSE" as const, name: "餐饮", color: "#F97316" },
    { kind: "EXPENSE" as const, name: "交通", color: "#3B82F6" },
    { kind: "EXPENSE" as const, name: "购物", color: "#8B5CF6" },
    { kind: "EXPENSE" as const, name: "居住", color: "#10B981" },
    { kind: "EXPENSE" as const, name: "娱乐", color: "#EC4899" },
    { kind: "EXPENSE" as const, name: "医疗", color: "#EF4444" },
    { kind: "INCOME" as const, name: "工资", color: "#22C55E" },
  ];
  for (const category of categories) {
    await prisma.category.upsert({
      where: {
        userId_kind_name: {
          kind: category.kind,
          name: category.name,
          userId: user.id,
        },
      },
      create: { ...category, userId: user.id },
      update: {},
    });
  }

  const accounts = [
    { kind: "CASH" as const, name: "现金" },
    { kind: "DEBIT_CARD" as const, name: "储蓄卡" },
    { kind: "CREDIT_CARD" as const, name: "信用卡" },
    { kind: "DIGITAL_WALLET" as const, name: "支付宝" },
  ];
  for (const account of accounts) {
    await prisma.financialAccount.upsert({
      where: { userId_name: { name: account.name, userId: user.id } },
      create: { ...account, userId: user.id },
      update: {},
    });
  }

  console.log(
    `Demo user ready: ${demoEmail} (password only in local development; set SEED_DEMO_USER=false to skip)`,
  );
}

main().catch((error) => {
  console.error("Seed failed", error);
  process.exitCode = 1;
});
