import "dotenv/config";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { hash } from "argon2";

import { Prisma, PrismaClient } from "../src/generated/prisma/client.js";

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

  const tomorrow = shanghaiTime(1, 9, 0);
  const tomorrowEvening = shanghaiTime(1, 18, 0);
  await prisma.calendarEvent.upsert({
    where: { id: "demo-calendar-event" },
    create: {
      allDay: false,
      endsAt: shanghaiTime(1, 10, 0),
      id: "demo-calendar-event",
      startsAt: tomorrow,
      status: "SCHEDULED",
      title: "演示日程：项目周会",
      userId: user.id,
    },
    update: {},
  });

  await prisma.task.upsert({
    where: { id: "demo-task-open" },
    create: {
      dueAt: tomorrowEvening,
      id: "demo-task-open",
      priority: "HIGH",
      status: "OPEN",
      title: "演示待办：提交周报",
      userId: user.id,
    },
    update: {},
  });
  await prisma.task.upsert({
    where: { id: "demo-task-done" },
    create: {
      completedAt: new Date(),
      id: "demo-task-done",
      priority: "MEDIUM",
      status: "COMPLETED",
      title: "演示待办：整理发票",
      userId: user.id,
    },
    update: {},
  });

  await prisma.reminder.upsert({
    where: { id: "demo-reminder-once" },
    create: {
      id: "demo-reminder-once",
      scheduleType: "ONCE",
      scheduledAt: tomorrow,
      startsAt: tomorrow,
      status: "SCHEDULED",
      targetType: "STANDALONE",
      title: "演示提醒：明天开会",
      userId: user.id,
    },
    update: {},
  });
  await prisma.reminder.upsert({
    where: { id: "demo-reminder-daily" },
    create: {
      id: "demo-reminder-daily",
      recurrenceJson: { interval: 1 },
      scheduleType: "DAILY",
      scheduledAt: tomorrow,
      startsAt: tomorrow,
      status: "SCHEDULED",
      targetType: "STANDALONE",
      title: "演示提醒：每日喝水",
      userId: user.id,
    },
    update: {},
  });

  const demoTrip = await prisma.trip.upsert({
    where: { id: "demo-trip" },
    create: {
      budgetAmount: new Prisma.Decimal("3000.00"),
      destination: "杭州",
      endDate: shanghaiTime(7, 0, 0),
      id: "demo-trip",
      startDate: shanghaiTime(5, 0, 0),
      title: "演示行程：杭州三日",
      userId: user.id,
    },
    update: {},
  });

  await prisma.tripItem.upsert({
    where: { id: "demo-trip-item-activity" },
    create: {
      endsAt: shanghaiTime(5, 12, 0),
      id: "demo-trip-item-activity",
      location: "西湖",
      position: 1,
      startsAt: shanghaiTime(5, 9, 0),
      tripId: demoTrip.id,
      type: "ACTIVITY",
    },
    update: {},
  });
  await prisma.tripItem.upsert({
    where: { id: "demo-trip-item-stay" },
    create: {
      endsAt: shanghaiTime(5, 18, 0),
      id: "demo-trip-item-stay",
      location: "灵隐寺",
      position: 2,
      startsAt: shanghaiTime(5, 15, 0),
      tripId: demoTrip.id,
      type: "STAY",
    },
    update: {},
  });

  await prisma.packingItem.upsert({
    where: { id: "demo-packing-id" },
    create: {
      checked: true,
      id: "demo-packing-id",
      position: 1,
      text: "身份证",
      tripId: demoTrip.id,
    },
    update: {},
  });
  await prisma.packingItem.upsert({
    where: { id: "demo-packing-charger" },
    create: {
      checked: false,
      id: "demo-packing-charger",
      position: 2,
      text: "充电宝",
      tripId: demoTrip.id,
    },
    update: {},
  });

  console.log(
    `Demo user ready: ${demoEmail} (password only in local development; set SEED_DEMO_USER=false to skip)`,
  );
}

function shanghaiTime(daysFromNow: number, hour: number, minute: number): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Shanghai",
    year: "numeric",
  }).formatToParts(new Date());
  const byType = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  const year = Number(byType.year ?? "1970");
  const month = Number(byType.month ?? "01");
  const day = Number(byType.day ?? "01");
  return new Date(
    Date.UTC(year, month - 1, day + daysFromNow, hour, minute) -
      8 * 60 * 60 * 1000,
  );
}

main().catch((error) => {
  console.error("Seed failed", error);
  process.exitCode = 1;
});
